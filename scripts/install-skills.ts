import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * The assistants this template installs skills for. This table is the only
 * place a vendor is named: adding an assistant is one entry, and nothing under
 * `skills/` knows any of these directories exist.
 */
export interface AssistantTarget {
  /** The name `--target=<assistant>` accepts. */
  key: string;
  /** Skills directory, relative to the repository root. */
  directory: string;
}

export const SUPPORTED_ASSISTANTS: readonly AssistantTarget[] = [
  { key: "claude", directory: ".claude/skills" },
  { key: "codex", directory: ".codex/skills" },
  { key: "copilot", directory: ".github/skills" },
];

/** The canonical, vendor-neutral source, relative to the repository root. */
export const SKILL_SOURCE_DIRECTORY = "skills";

/** Every skill is a directory containing this file. */
export const SKILL_MANIFEST = "SKILL.md";

export class InvalidSkillError extends Error {}
export class UnknownAssistantError extends Error {}

export interface DiscoveredSkill {
  name: string;
  /** Absolute path of the skill's canonical directory. */
  root: string;
  /** Every file in the skill, as paths relative to `root`, sorted. */
  files: string[];
}

async function filesUnder(root: string, directory = root): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesUnder(root, path));
    else if (entry.isFile()) found.push(relative(root, path));
  }
  return found.sort((left, right) => left.localeCompare(right));
}

/**
 * The ownership set: every `skills/<name>/` directory. Loose files beside them
 * — `README.md` — are documentation of the source, not skills, and are neither
 * installed nor owned in a target directory.
 */
export async function discoverSkills(repositoryRoot = process.cwd()): Promise<DiscoveredSkill[]> {
  const sourceRoot = resolve(repositoryRoot, SKILL_SOURCE_DIRECTORY);
  let entries;
  try {
    entries = await readdir(sourceRoot, { withFileTypes: true });
  } catch {
    throw new InvalidSkillError(`Canonical skill source directory is missing or unreadable: ${SKILL_SOURCE_DIRECTORY}/`);
  }

  const skills: DiscoveredSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const root = join(sourceRoot, entry.name);
    const files = await filesUnder(root);
    if (!files.includes(SKILL_MANIFEST)) {
      throw new InvalidSkillError(
        `Skill "${entry.name}" has no ${SKILL_MANIFEST}: every skill is a directory containing ${SKILL_SOURCE_DIRECTORY}/<name>/${SKILL_MANIFEST}`,
      );
    }
    skills.push({ name: entry.name, root, files });
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export type FileOutcome = "created" | "replaced" | "unchanged" | "removed";

export interface InstallEntry {
  assistant: string;
  skill: string;
  /** Repository-relative path of the installed copy. */
  path: string;
  outcome: FileOutcome;
}

export type CheckStatus = "match" | "missing" | "differs" | "unexpected";

export interface CheckEntry {
  assistant: string;
  skill: string;
  path: string;
  status: CheckStatus;
}

export interface ListEntry {
  assistant: string;
  skill: string;
  path: string;
}

async function readOrNull(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

function posix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

function installedPath(assistant: AssistantTarget, skill: DiscoveredSkill, file: string): string {
  return posix(join(assistant.directory, skill.name, file));
}

/**
 * Resolves `--target=<assistant>`. Absent, every supported assistant is
 * written. An unknown name fails before anything is written rather than
 * installing a subset and reporting the problem afterwards.
 */
export function selectedAssistants(argv: readonly string[]): AssistantTarget[] {
  const index = argv.findIndex((argument) => argument === "--target" || argument.startsWith("--target="));
  if (index === -1) return [...SUPPORTED_ASSISTANTS];
  const argument = argv[index]!;
  const value = argument.startsWith("--target=") ? argument.slice("--target=".length) : argv[index + 1];
  const supported = SUPPORTED_ASSISTANTS.map((assistant) => assistant.key).join(", ");
  if (!value || value.startsWith("-")) {
    throw new UnknownAssistantError(`--target requires an assistant name. Supported: ${supported}`);
  }
  const assistant = SUPPORTED_ASSISTANTS.find((candidate) => candidate.key === value);
  if (!assistant) {
    throw new UnknownAssistantError(`Unknown assistant "${value}". Supported: ${supported}`);
  }
  return [assistant];
}

/**
 * Copies every discovered skill into each selected assistant's directory.
 *
 * Ownership is the set of discovered skill names and nothing else: a target
 * directory's other contents — another tool's skills, a developer's own — are
 * never read, moved, or removed. Within a directory this installer does own,
 * a file the canonical source no longer contains is removed, so an installed
 * copy is the source rather than the source plus history.
 */
export async function installSkills(
  skills: readonly DiscoveredSkill[],
  assistants: readonly AssistantTarget[],
  repositoryRoot = process.cwd(),
): Promise<InstallEntry[]> {
  const entries: InstallEntry[] = [];
  for (const assistant of assistants) {
    for (const skill of skills) {
      const destinationRoot = resolve(repositoryRoot, assistant.directory, skill.name);
      await mkdir(destinationRoot, { recursive: true });

      for (const file of skill.files) {
        const destination = join(destinationRoot, file);
        const source = await readFile(join(skill.root, file));
        const existing = await readOrNull(destination);
        const outcome: FileOutcome = existing === null ? "created"
          : existing.equals(source) ? "unchanged"
          : "replaced";
        if (outcome !== "unchanged") {
          await mkdir(dirname(destination), { recursive: true });
          await writeFile(destination, source);
        }
        entries.push({ assistant: assistant.key, skill: skill.name, path: installedPath(assistant, skill, file), outcome });
      }

      const owned = new Set(skill.files);
      for (const stale of await filesUnder(destinationRoot)) {
        if (owned.has(stale)) continue;
        await rm(join(destinationRoot, stale));
        entries.push({ assistant: assistant.key, skill: skill.name, path: installedPath(assistant, skill, stale), outcome: "removed" });
      }
    }
  }
  return entries;
}

/**
 * Compares every installed copy against its canonical source without writing.
 * Installed copies are committed, so they can go stale; this is what makes
 * committing them safe.
 */
export async function checkSkills(
  skills: readonly DiscoveredSkill[],
  assistants: readonly AssistantTarget[],
  repositoryRoot = process.cwd(),
): Promise<CheckEntry[]> {
  const entries: CheckEntry[] = [];
  for (const assistant of assistants) {
    for (const skill of skills) {
      const destinationRoot = resolve(repositoryRoot, assistant.directory, skill.name);
      for (const file of skill.files) {
        const installed = await readOrNull(join(destinationRoot, file));
        const source = await readFile(join(skill.root, file));
        const status: CheckStatus = installed === null ? "missing" : installed.equals(source) ? "match" : "differs";
        entries.push({ assistant: assistant.key, skill: skill.name, path: installedPath(assistant, skill, file), status });
      }

      const owned = new Set(skill.files);
      let present: string[];
      try {
        present = await filesUnder(destinationRoot);
      } catch {
        continue;
      }
      for (const extra of present) {
        if (owned.has(extra)) continue;
        entries.push({ assistant: assistant.key, skill: skill.name, path: installedPath(assistant, skill, extra), status: "unexpected" });
      }
    }
  }
  return entries;
}

/** What a run would write, without writing it. */
export function listSkills(
  skills: readonly DiscoveredSkill[],
  assistants: readonly AssistantTarget[],
): ListEntry[] {
  return assistants.flatMap((assistant) =>
    skills.flatMap((skill) =>
      skill.files.map((file) => ({ assistant: assistant.key, skill: skill.name, path: installedPath(assistant, skill, file) })),
    ),
  );
}

export interface RunResult {
  exitCode: number;
  lines: string[];
}

const CHECK_FAILURES: Record<Exclude<CheckStatus, "match">, string> = {
  missing: "missing",
  differs: "differs from its source",
  unexpected: "is not part of its source",
};

/**
 * The command line. Returns rather than exits so the whole surface is testable
 * without spawning a process.
 */
export async function runInstaller(argv: readonly string[], repositoryRoot = process.cwd()): Promise<RunResult> {
  const lines: string[] = [];
  let assistants: AssistantTarget[];
  let skills: DiscoveredSkill[];
  try {
    // Resolve both before writing anything, so a bad invocation writes nothing.
    assistants = selectedAssistants(argv);
    skills = await discoverSkills(repositoryRoot);
  } catch (error: unknown) {
    return { exitCode: 1, lines: [error instanceof Error ? error.message : String(error)] };
  }

  if (skills.length === 0) {
    return { exitCode: 0, lines: [`No skills found in ${SKILL_SOURCE_DIRECTORY}/; nothing to install.`] };
  }

  if (argv.includes("--list")) {
    lines.push(`${skills.length} skill(s) in ${SKILL_SOURCE_DIRECTORY}/: ${skills.map((skill) => skill.name).join(", ")}`);
    for (const entry of listSkills(skills, assistants)) lines.push(`  ${entry.assistant}  ${entry.path}`);
    lines.push("Nothing was written.");
    return { exitCode: 0, lines };
  }

  if (argv.includes("--check")) {
    const entries = await checkSkills(skills, assistants, repositoryRoot);
    const failures = entries.filter((entry) => entry.status !== "match");
    for (const failure of failures) {
      lines.push(`  ${failure.path} ${CHECK_FAILURES[failure.status as Exclude<CheckStatus, "match">]}`);
    }
    lines.push(failures.length === 0
      ? `All ${entries.length} installed skill file(s) match ${SKILL_SOURCE_DIRECTORY}/.`
      : `${failures.length} of ${entries.length} installed skill file(s) are out of date. Run: bun run install:skills`);
    return { exitCode: failures.length === 0 ? 0 : 1, lines };
  }

  const entries = await installSkills(skills, assistants, repositoryRoot);
  for (const entry of entries) lines.push(`  ${entry.outcome.padEnd(9)} ${entry.path}`);
  const written = entries.filter((entry) => entry.outcome !== "unchanged").length;
  lines.push(`Installed ${skills.length} skill(s) for ${assistants.map((assistant) => assistant.key).join(", ")}; ${written} file(s) changed.`);
  return { exitCode: 0, lines };
}

if (import.meta.main) {
  const result = await runInstaller(Bun.argv.slice(2));
  for (const line of result.lines) console.log(line);
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
