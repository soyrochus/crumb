import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SUPPORTED_ASSISTANTS,
  discoverSkills,
  runInstaller,
} from "../../scripts/install-skills";

const roots: string[] = [];

const CLAUDE = ".claude/skills";
const CODEX = ".codex/skills";
const COPILOT = ".github/skills";

async function fixture(skills: Record<string, Record<string, string>> = {
  "crumb-one": { "SKILL.md": "---\nname: crumb-one\n---\nfirst\n" },
  "crumb-two": { "SKILL.md": "---\nname: crumb-two\n---\nsecond\n", "reference/notes.md": "detail\n" },
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crumb-install-skills-"));
  roots.push(root);
  for (const [name, files] of Object.entries(skills)) {
    for (const [file, contents] of Object.entries(files)) {
      const path = join(root, "skills", name, file);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, contents);
    }
  }
  return root;
}

async function write(root: string, path: string, contents: string): Promise<void> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), contents);
}

async function read(root: string, path: string): Promise<string> {
  return await readFile(join(root, path), "utf8");
}

async function tree(root: string, directory: string): Promise<string[]> {
  try {
    return (await readdir(join(root, directory))).sort();
  } catch {
    return [];
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("skill discovery", () => {
  test("the ownership set is the directories under skills/", async () => {
    const root = await fixture();
    await write(root, "skills/README.md", "not a skill\n");
    expect((await discoverSkills(root)).map((skill) => skill.name)).toEqual(["crumb-one", "crumb-two"]);
  });

  test("a directory without SKILL.md fails with a diagnostic naming it", async () => {
    const root = await fixture();
    await write(root, "skills/crumb-broken/notes.md", "no manifest\n");
    await expect(discoverSkills(root)).rejects.toThrow('Skill "crumb-broken" has no SKILL.md');
  });
});

describe("installation", () => {
  test("a default run installs every skill into all three target layouts", async () => {
    const root = await fixture();
    const result = await runInstaller([], root);

    expect(result.exitCode).toBe(0);
    for (const directory of [CLAUDE, CODEX, COPILOT]) {
      expect(await tree(root, directory)).toEqual(["crumb-one", "crumb-two"]);
      expect(await read(root, `${directory}/crumb-one/SKILL.md`)).toBe("---\nname: crumb-one\n---\nfirst\n");
      expect(await read(root, `${directory}/crumb-two/reference/notes.md`)).toBe("detail\n");
    }
    expect(result.lines.join("\n")).toContain(`${CLAUDE}/crumb-one/SKILL.md`);
  });

  test("the target directories are created when they do not exist", async () => {
    const root = await fixture();
    expect(await tree(root, CLAUDE)).toEqual([]);
    expect((await runInstaller([], root)).exitCode).toBe(0);
    expect(await tree(root, CLAUDE)).toEqual(["crumb-one", "crumb-two"]);
  });

  test("--target writes one assistant and leaves the others byte-for-byte unchanged", async () => {
    const root = await fixture();
    await write(root, `${CODEX}/crumb-one/SKILL.md`, "stale\n");

    const result = await runInstaller(["--target=claude"], root);

    expect(result.exitCode).toBe(0);
    expect(await tree(root, CLAUDE)).toEqual(["crumb-one", "crumb-two"]);
    expect(await read(root, `${CODEX}/crumb-one/SKILL.md`)).toBe("stale\n");
    expect(await tree(root, COPILOT)).toEqual([]);
  });

  test("an unknown --target fails, lists the supported assistants, and writes nothing", async () => {
    const root = await fixture();
    const result = await runInstaller(["--target=emacs"], root);

    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain('Unknown assistant "emacs"');
    for (const assistant of SUPPORTED_ASSISTANTS) {
      expect(result.lines.join("\n")).toContain(assistant.key);
      expect(await tree(root, assistant.directory)).toEqual([]);
    }
  });

  test("--target without a value fails rather than installing everywhere", async () => {
    const root = await fixture();
    const result = await runInstaller(["--target"], root);

    expect(result.exitCode).toBe(1);
    expect(await tree(root, CLAUDE)).toEqual([]);
  });
});

describe("coexistence with skills the template does not own", () => {
  test("foreign skills in a target directory are left unchanged", async () => {
    const root = await fixture();
    await write(root, `${CLAUDE}/openspec-propose/SKILL.md`, "another tool wrote this\n");
    await write(root, `${COPILOT}/my-own-skill/SKILL.md`, "hand written\n");

    expect((await runInstaller([], root)).exitCode).toBe(0);

    expect(await read(root, `${CLAUDE}/openspec-propose/SKILL.md`)).toBe("another tool wrote this\n");
    expect(await read(root, `${COPILOT}/my-own-skill/SKILL.md`)).toBe("hand written\n");
    expect(await tree(root, CLAUDE)).toEqual(["crumb-one", "crumb-two", "openspec-propose"]);
  });

  test("a skill absent from skills/ is left in place rather than deleted", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await rm(join(root, "skills/crumb-two"), { recursive: true });

    expect((await runInstaller([], root)).exitCode).toBe(0);

    expect(await read(root, `${CLAUDE}/crumb-two/SKILL.md`)).toBe("---\nname: crumb-two\n---\nsecond\n");
  });
});

describe("reinstallation", () => {
  test("an edited installed copy is restored and reported as replaced", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await write(root, `${CLAUDE}/crumb-one/SKILL.md`, "edited in the wrong place\n");

    const result = await runInstaller([], root);

    expect(await read(root, `${CLAUDE}/crumb-one/SKILL.md`)).toBe("---\nname: crumb-one\n---\nfirst\n");
    expect(result.lines).toContain(`  replaced  ${CLAUDE}/crumb-one/SKILL.md`);
    expect(result.lines).toContain(`  unchanged ${CODEX}/crumb-one/SKILL.md`);
  });

  test("a file the source no longer contains is removed from a skill the installer owns", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await write(root, `${CLAUDE}/crumb-one/leftover.md`, "from an older version\n");

    const result = await runInstaller(["--target=claude"], root);

    expect(await tree(root, `${CLAUDE}/crumb-one`)).toEqual(["SKILL.md"]);
    expect(result.lines).toContain(`  removed   ${CLAUDE}/crumb-one/leftover.md`);
  });
});

describe("--list", () => {
  test("prints the skills and the paths a run would write, and writes nothing", async () => {
    const root = await fixture();
    const result = await runInstaller(["--list"], root);

    expect(result.exitCode).toBe(0);
    const output = result.lines.join("\n");
    expect(output).toContain("crumb-one, crumb-two");
    expect(output).toContain(`${COPILOT}/crumb-two/reference/notes.md`);
    expect(await tree(root, CLAUDE)).toEqual([]);
  });
});

describe("--check", () => {
  test("succeeds and modifies nothing when every copy is in sync", async () => {
    const root = await fixture();
    await runInstaller([], root);

    const result = await runInstaller(["--check"], root);

    expect(result.exitCode).toBe(0);
    expect(result.lines.at(-1)).toContain("match");
    expect(await read(root, `${CLAUDE}/crumb-one/SKILL.md`)).toBe("---\nname: crumb-one\n---\nfirst\n");
  });

  test("fails per file when a canonical source is edited, leaving every file unchanged", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await write(root, "skills/crumb-one/SKILL.md", "---\nname: crumb-one\n---\nrevised\n");

    const result = await runInstaller(["--check"], root);

    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain(`  ${CLAUDE}/crumb-one/SKILL.md differs from its source`);
    expect(result.lines).toContain(`  ${CODEX}/crumb-one/SKILL.md differs from its source`);
    expect(result.lines).toContain(`  ${COPILOT}/crumb-one/SKILL.md differs from its source`);
    expect(await read(root, `${CLAUDE}/crumb-one/SKILL.md`)).toBe("---\nname: crumb-one\n---\nfirst\n");
  });

  test("fails when an installed copy is edited", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await write(root, `${CODEX}/crumb-two/reference/notes.md`, "drifted\n");

    const result = await runInstaller(["--check"], root);

    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain(`  ${CODEX}/crumb-two/reference/notes.md differs from its source`);
    expect(await read(root, `${CODEX}/crumb-two/reference/notes.md`)).toBe("drifted\n");
  });

  test("fails when an installed copy is missing", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await rm(join(root, COPILOT, "crumb-one"), { recursive: true });

    const result = await runInstaller(["--check"], root);

    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain(`  ${COPILOT}/crumb-one/SKILL.md missing`);
  });

  test("fails when a skill directory holds a file its source does not", async () => {
    const root = await fixture();
    await runInstaller([], root);
    await write(root, `${CLAUDE}/crumb-one/extra.md`, "unowned\n");

    const result = await runInstaller(["--check"], root);

    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain(`  ${CLAUDE}/crumb-one/extra.md is not part of its source`);
  });

  test("narrows to one assistant with --target", async () => {
    const root = await fixture();
    await runInstaller(["--target=claude"], root);

    expect((await runInstaller(["--check", "--target=claude"], root)).exitCode).toBe(0);
    expect((await runInstaller(["--check"], root)).exitCode).toBe(1);
  });
});

describe("the shipped skills", () => {
  test("include crumb-adopt-existing-project with committed copies in sync", async () => {
    const repo = process.cwd();
    const names = (await discoverSkills(repo)).map((skill) => skill.name);
    expect(names).toContain("crumb-adopt-existing-project");

    const result = await runInstaller(["--check"], repo);
    expect(result.exitCode).toBe(0);
  });
});
