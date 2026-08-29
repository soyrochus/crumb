import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ALLOWLIST,
  APP_CONFIG_FRAGMENT,
  GITIGNORE_FRAGMENT,
  SCRIPT_EXCLUSIONS,
  STAGING_DIRNAME,
  assertCrumbClone,
  packageJsonFragment,
  parseArgs,
  plannedFiles,
  runExtract,
} from "../../scripts/extract";

const REPO = process.cwd();
const temps: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "crumb-extract-"));
  temps.push(dir);
  return dir;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function relFilesUnder(root: string, dir = root, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await relFilesUnder(root, full, out);
    else out.push(full.slice(root.length + 1));
  }
  return out.sort();
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  await rm(join(REPO, STAGING_DIRNAME), { recursive: true, force: true });
});

describe("clone assertion", () => {
  test("resolves against the real repository", async () => {
    await expect(assertCrumbClone(REPO)).resolves.toBeUndefined();
  });

  test("rejects a directory that is not a Crumb clone, naming the missing path", async () => {
    const dir = await tempDir();
    await expect(assertCrumbClone(dir)).rejects.toThrow(/Allowlisted (dir|file) "src\/kit"/);
  });
});

describe("planned file set", () => {
  test("covers the kit, the full pipeline, the entry point, the tests, the skills, and the docs", async () => {
    const planned = (await plannedFiles(REPO)).map((file) => file.relative);
    expect(planned).toContain("src/kit/host/main.ts");
    expect(planned).toContain("scripts/dev.ts");
    expect(planned).toContain("scripts/build.ts");
    expect(planned).toContain("scripts/extract.ts");
    expect(planned).toContain("scripts/install-skills.ts");
    expect(planned).toContain("scripts/feasibility.ts");
    expect(planned).toContain("main.ts");
    expect(planned).toContain("tsconfig.json");
    expect(planned).toContain("native/nativewindow-webview-v1.0.6-wayland.patch");
    expect(planned.some((path) => path.startsWith("test/kit/"))).toBe(true);
    expect(planned).toContain("skills/crumb-adopt-existing-project/SKILL.md");
    expect(planned).toContain("docs/how-to-build-a-desktop-app-with-bun.md");
  });

  test("stages the committed installed copies of Crumb's own skills only", async () => {
    const planned = (await plannedFiles(REPO)).map((file) => file.relative);
    expect(planned).toContain(".claude/skills/crumb-add-operation/SKILL.md");
    expect(planned).toContain(".codex/skills/crumb-adopt-existing-project/SKILL.md");
    expect(planned).toContain(".github/skills/crumb-new-application/SKILL.md");
    expect(planned.some((path) => path.includes("openspec-"))).toBe(false);
  });

  test("excludes only the example-verification scripts", async () => {
    expect([...SCRIPT_EXCLUSIONS].sort()).toEqual(["verify-performance.ts", "verify-readonly.ts"]);
    const planned = (await plannedFiles(REPO)).map((file) => file.relative);
    for (const name of SCRIPT_EXCLUSIONS) {
      expect(planned).not.toContain(`scripts/${name}`);
    }
  });

  test("carries no application-owned source", async () => {
    const planned = (await plannedFiles(REPO)).map((file) => file.relative);
    expect(planned.some((path) => path.startsWith("src/app/"))).toBe(false);
    expect(planned.some((path) => path.startsWith("examples/"))).toBe(false);
    expect(planned).not.toContain("app.config.ts");
    expect(planned).not.toContain("README.md");
  });

  test("omits the kit tests that assert against this repository's own registry", async () => {
    const planned = (await plannedFiles(REPO)).map((file) => file.relative);
    expect(planned).toContain("test/kit/platform.test.ts");
    expect(planned).not.toContain("test/kit/application-registry.test.ts");
    expect(planned).not.toContain("test/kit/build-time-selection.test.ts");
    expect(planned).not.toContain("test/kit/native-extension-watch.test.ts");
  });

  test("the allowlist is only template-owned roots", () => {
    expect(ALLOWLIST.map((entry) => entry.path)).toEqual([
      "src/kit",
      "scripts",
      "skills",
      "docs",
      "native/nativewindow-webview-v1.0.6-wayland.patch",
      "main.ts",
      "tsconfig.json",
      "test/kit",
    ]);
  });

  test("no staged skill still points at openspec/specs with a clone-relative path", async () => {
    const planned = await plannedFiles(REPO);
    for (const file of planned) {
      if (!file.relative.endsWith("SKILL.md")) continue;
      expect(await readFile(file.source, "utf8")).not.toContain("../../openspec/specs/");
    }
  });
});

describe("staging", () => {
  test("stages the machinery, the fragments, and MERGE.md into crumb-source/ only", async () => {
    const dest = await tempDir();
    await writeFile(join(dest, "package.json"), '{ "name": "existing" }\n');
    await mkdir(join(dest, "src"));
    await writeFile(join(dest, "src", "my-app.ts"), "// mine\n");

    const result = await runExtract(["--dest", dest], REPO);
    expect(result.exitCode).toBe(0);

    const staged = join(dest, STAGING_DIRNAME);
    expect(await pathExists(join(staged, "main.ts"))).toBe(true);
    expect(await pathExists(join(staged, "src/kit/host/main.ts"))).toBe(true);
    expect(await pathExists(join(staged, "tsconfig.json"))).toBe(true);
    expect(await pathExists(join(staged, "fragments/package.json"))).toBe(true);
    expect(await pathExists(join(staged, "fragments/gitignore"))).toBe(true);
    expect(await pathExists(join(staged, "fragments/app.config.ts"))).toBe(true);
    expect(await pathExists(join(staged, "MERGE.md"))).toBe(true);

    expect(await pathExists(join(staged, "skills/crumb-adopt-existing-project/SKILL.md"))).toBe(true);
    expect(await pathExists(join(staged, "docs/how-to-build-a-desktop-app-with-bun.md"))).toBe(true);
    expect(await pathExists(join(staged, ".claude/skills/crumb-add-operation/SKILL.md"))).toBe(true);

    const stagedFiles = await relFilesUnder(staged);
    expect(stagedFiles.some((path) => path.startsWith("src/app/"))).toBe(false);
    expect(stagedFiles.some((path) => path.startsWith("examples/"))).toBe(false);
    expect(stagedFiles.some((path) => path.includes("openspec-"))).toBe(false);
  });

  test("writes only crumb-source/ and the assistant skill dirs, leaving the target's own files untouched", async () => {
    const dest = await tempDir();
    await writeFile(join(dest, "package.json"), '{ "name": "existing" }\n');
    await writeFile(join(dest, "tsconfig.json"), '{ "mine": true }\n');

    await runExtract(["--dest", dest], REPO);

    const allowed = ["crumb-source", ".claude", ".codex", ".github", "package.json", "tsconfig.json"];
    expect((await readdir(dest)).filter((name) => !allowed.includes(name))).toEqual([]);
    expect(await readFile(join(dest, "package.json"), "utf8")).toBe('{ "name": "existing" }\n');
    expect(await readFile(join(dest, "tsconfig.json"), "utf8")).toBe('{ "mine": true }\n');

    // The only thing under the assistant dirs is Crumb's own crumb- skills.
    for (const assistant of [".claude", ".codex", ".github"]) {
      const skills = await readdir(join(dest, assistant, "skills"));
      expect(skills.every((name) => name.startsWith("crumb-"))).toBe(true);
    }
  });

  test("never creates a staging directory inside the clone", async () => {
    const dest = await tempDir();
    await runExtract(["--dest", dest], REPO);
    expect(await pathExists(join(REPO, STAGING_DIRNAME))).toBe(false);
  });
});

describe("assistant skill bootstrap", () => {
  test("installs the Crumb skills into the target's assistant directories", async () => {
    const dest = await tempDir();
    const result = await runExtract(["--dest", dest], REPO);
    expect(result.exitCode).toBe(0);

    for (const assistant of [".claude", ".codex", ".github"]) {
      expect(await pathExists(join(dest, assistant, "skills/crumb-adopt-existing-project/SKILL.md"))).toBe(true);
      expect(await pathExists(join(dest, assistant, "skills/crumb-add-operation/SKILL.md"))).toBe(true);
    }
    expect(result.lines.join("\n")).toContain("Assistant skills:");
  });

  test("leaves a non-Crumb skill in the target untouched", async () => {
    const dest = await tempDir();
    await mkdir(join(dest, ".claude/skills/my-own-skill"), { recursive: true });
    await writeFile(join(dest, ".claude/skills/my-own-skill/SKILL.md"), "mine\n");

    await runExtract(["--dest", dest], REPO);

    expect(await readFile(join(dest, ".claude/skills/my-own-skill/SKILL.md"), "utf8")).toBe("mine\n");
    expect(await pathExists(join(dest, ".claude/skills/crumb-adopt-existing-project/SKILL.md"))).toBe(true);
  });

  test("--dry-run installs no skill files but still reports them", async () => {
    const dest = await tempDir();
    const result = await runExtract(["--dest", dest, "--dry-run"], REPO);

    expect(result.exitCode).toBe(0);
    expect(await readdir(dest)).toEqual([]);
    expect(result.lines.join("\n")).toContain("Would install");
  });
});

describe("fragments", () => {
  test("the package.json fragment adds only what Crumb needs", async () => {
    const fragment = JSON.parse(await packageJsonFragment(REPO)) as {
      type: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(fragment.type).toBe("module");
    expect(fragment.dependencies).toHaveProperty("@nativewindow/webview");
    expect(fragment.scripts).toHaveProperty("dev");
    expect(fragment.scripts).toHaveProperty("extract");
    expect(fragment.scripts).toHaveProperty("install:skills");
    expect(fragment.scripts).not.toHaveProperty("verify:readonly");
    expect(fragment.scripts).not.toHaveProperty("verify:performance");
  });

  test("the gitignore fragment ignores the generated trees", () => {
    expect(GITIGNORE_FRAGMENT).toContain("node_modules/");
    expect(GITIGNORE_FRAGMENT).toContain("dist/");
    expect(GITIGNORE_FRAGMENT).toContain(".build/");
  });

  test("the registry fragment is trimmed to the single starter", () => {
    expect(APP_CONFIG_FRAGMENT).toContain('default: "starter"');
    expect(APP_CONFIG_FRAGMENT).toContain("applications: { starter }");
    expect(APP_CONFIG_FRAGMENT).not.toContain("file-explorer");
  });

  test("MERGE.md records the source version and points at the adopt skill", async () => {
    const dest = await tempDir();
    await runExtract(["--dest", dest], REPO);
    const merge = await readFile(join(dest, STAGING_DIRNAME, "MERGE.md"), "utf8");
    expect(merge).toContain("Extracted from Crumb");
    expect(merge).toContain("crumb-adopt-existing-project");
  });
});

describe("argument and safety guards", () => {
  test("parseArgs requires --dest", () => {
    expect(() => parseArgs([])).toThrow("--dest <path> is required");
    expect(() => parseArgs(["--dest", "--force"])).toThrow("--dest <path> is required");
  });

  test("a missing --dest exits non-zero and writes nothing", async () => {
    const result = await runExtract([], REPO);
    expect(result.exitCode).toBe(1);
    expect(await pathExists(join(REPO, STAGING_DIRNAME))).toBe(false);
  });

  test("a --dest that is not a directory exits non-zero", async () => {
    const result = await runExtract(["--dest", join(tmpdir(), "crumb-extract-does-not-exist")], REPO);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("not an existing directory");
  });

  test("a --dest inside the clone is refused", async () => {
    const result = await runExtract(["--dest", join(REPO, "scripts")], REPO);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("inside the Crumb clone");
  });

  test("an existing non-empty crumb-source/ stops the command unless --force is given", async () => {
    const dest = await tempDir();
    await mkdir(join(dest, STAGING_DIRNAME));
    await writeFile(join(dest, STAGING_DIRNAME, "mine.txt"), "keep me\n");

    const blocked = await runExtract(["--dest", dest], REPO);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.lines.join("\n")).toContain("already exists");

    const forced = await runExtract(["--dest", dest, "--force"], REPO);
    expect(forced.exitCode).toBe(0);
    expect(await readFile(join(dest, STAGING_DIRNAME, "mine.txt"), "utf8")).toBe("keep me\n");
    expect(await pathExists(join(dest, STAGING_DIRNAME, "main.ts"))).toBe(true);
  });
});

describe("--dry-run", () => {
  test("prints the full plan and writes nothing", async () => {
    const dest = await tempDir();
    const result = await runExtract(["--dest", dest, "--dry-run"], REPO);

    expect(result.exitCode).toBe(0);
    expect(result.lines.join("\n")).toContain("Would stage");
    expect(result.lines.join("\n")).toContain("Next steps");
    expect(await readdir(dest)).toEqual([]);
  });
});
