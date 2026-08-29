/**
 * Extracts Crumb's template-owned machinery from this clone into an existing
 * external project. It writes only into `<dest>/crumb-source/` — a staging
 * directory the developer (or the `crumb-adopt-existing-project` skill) then
 * applies by hand — and never touches this clone or any file the target
 * already has.
 *
 *   bun run extract -- --dest <path> [--dry-run] [--force]
 *
 * The staged set is an explicit allowlist, not "everything except the
 * examples", so a new top-level directory can never leak into an extract.
 *
 * Returns rather than exits so the whole surface is testable without spawning a
 * process, mirroring scripts/install-skills.ts.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** A root the extract copies wholesale. Directories are copied recursively. */
export interface AllowlistEntry {
  kind: "dir" | "file";
  /** Path relative to the repository root. */
  path: string;
}

/**
 * Scripts that exist only to verify a worked example, plus the extract itself.
 * A `scripts/<name>` whose basename is here is not staged.
 */
export const SCRIPT_EXCLUSIONS: readonly string[] = [
  "extract.ts",
  "verify-readonly.ts",
  "verify-performance.ts",
  "feasibility.ts",
  "install-skills.ts",
];

/** The template-owned machinery. Nothing here is application-owned. */
export const ALLOWLIST: readonly AllowlistEntry[] = [
  { kind: "dir", path: "src/kit" },
  { kind: "dir", path: "scripts" },
  { kind: "file", path: "native/nativewindow-webview-v1.0.6-wayland.patch" },
  { kind: "file", path: "main.ts" },
  { kind: "file", path: "tsconfig.json" },
  { kind: "dir", path: "test/kit" },
];

/** The staging directory created inside the target. */
export const STAGING_DIRNAME = "crumb-source";

/** Scripts a vendored project should not carry (they need `examples/` or `skills/`). */
const FRAGMENT_SCRIPT_EXCLUSIONS: readonly string[] = [
  "install:skills",
  "verify:performance",
  "verify:readonly",
];

export class StaleAllowlistError extends Error {}
export class UsageError extends Error {}
export class ExtractError extends Error {}

function posix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
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
 * Fails if any allowlisted path is missing from the clone. A missing entry
 * means the template moved and this script is stale — a hard error, never a
 * silently smaller extract. Doubles as the "is this a Crumb clone" check.
 */
export async function assertCrumbClone(repositoryRoot: string): Promise<void> {
  for (const entry of ALLOWLIST) {
    const absolute = resolve(repositoryRoot, entry.path);
    const ok = entry.kind === "dir" ? await isDirectory(absolute) : await exists(absolute);
    if (!ok) {
      throw new StaleAllowlistError(
        `Allowlisted ${entry.kind} "${entry.path}" is not in this clone. `
          + "The template layout changed and scripts/extract.ts is out of date.",
      );
    }
  }
}

export interface PlannedFile {
  /** Absolute source path in the clone. */
  source: string;
  /** Path relative to the repository root, POSIX-separated. */
  relative: string;
}

/** Every file the extract would stage, in stable order. */
export async function plannedFiles(repositoryRoot: string): Promise<PlannedFile[]> {
  const planned: PlannedFile[] = [];
  for (const entry of ALLOWLIST) {
    const absolute = resolve(repositoryRoot, entry.path);
    if (entry.kind === "file") {
      planned.push({ source: absolute, relative: posix(entry.path) });
      continue;
    }
    for (const nested of await filesUnder(absolute)) {
      const relativePath = posix(join(entry.path, nested));
      if (entry.path === "scripts" && SCRIPT_EXCLUSIONS.includes(nested)) continue;
      planned.push({ source: join(absolute, nested), relative: relativePath });
    }
  }
  return planned.sort((left, right) => left.relative.localeCompare(right.relative));
}

export interface ParsedArgs {
  dest: string;
  dryRun: boolean;
  force: boolean;
}

const USAGE = "Usage: bun run extract -- --dest <path> [--dry-run] [--force]";

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let dest: string | undefined;
  let dryRun = false;
  let force = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--dry-run") dryRun = true;
    else if (argument === "--force") force = true;
    else if (argument === "--dest") dest = argv[index += 1];
    else if (argument.startsWith("--dest=")) dest = argument.slice("--dest=".length);
    else throw new UsageError(`Unknown argument "${argument}".\n${USAGE}`);
  }

  if (!dest || dest.startsWith("-")) throw new UsageError(`--dest <path> is required.\n${USAGE}`);
  return { dest, dryRun, force };
}

/** The `package.json` keys a target must add. Read from this clone so it stays current. */
export async function packageJsonFragment(repositoryRoot: string): Promise<string> {
  const manifest = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    if (FRAGMENT_SCRIPT_EXCLUSIONS.includes(name)) continue;
    scripts[name] = command;
  }
  if (!scripts.extract) scripts.extract = "bun run scripts/extract.ts";

  const fragment = {
    type: "module",
    scripts,
    dependencies: manifest.dependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
  };
  return `${JSON.stringify(fragment, null, 2)}\n`;
}

export const GITIGNORE_FRAGMENT = "node_modules/\ndist/\n.build/\n";

export const APP_CONFIG_FRAGMENT = `import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";

/**
 * The applications this repository can build. Trimmed to the single starter you
 * bring under src/app/. Add more with the crumb-new-application skill.
 */
export const registry: ApplicationRegistry = {
  default: "starter",
  applications: { starter },
};
`;

/** The ordered apply steps, each with the symptom of skipping it. */
export const MERGE_STEPS: readonly { title: string; skipping: string }[] = [
  {
    title: "Move the staged files into your project root (everything in crumb-source/ except fragments/ and MERGE.md).",
    skipping: "there is no kit, pipeline, or entry point to build with.",
  },
  {
    title: "Merge fragments/package.json into your package.json (type, scripts, dependencies, devDependencies).",
    skipping: "bun run dev/build are undefined and @nativewindow/webview is not installed.",
  },
  {
    title: "Append fragments/gitignore to your .gitignore.",
    skipping: "node_modules/, dist/, and .build/ get committed.",
  },
  {
    title: "Add your interface under src/app/: ui/{index.html,styles.css,app.ts}, host/handlers.ts, shared/{contracts,validators}.ts, and the app.config.ts that names them.",
    skipping: "there is no application for the template to run.",
  },
  {
    title: "Place fragments/app.config.ts at your project root as the application registry.",
    skipping: "main.ts and the dev/build scripts cannot resolve an application.",
  },
  {
    title: "Run bun install, then bun run dev.",
    skipping: "dependencies are unresolved and the window never opens.",
  },
];

export function mergeInstructions(source: { version: string; sha: string }): string {
  const steps = MERGE_STEPS.map(
    (step, index) => `${index + 1}. ${step.title}\n   Skipping this: ${step.skipping}`,
  ).join("\n\n");

  return `# Applying this extract

Extracted from Crumb ${source.version} (${source.sha}).

This directory is inert. It is not a runnable Crumb project — there is no
src/app/ and your package.json has not been merged. Apply it into your project
with the steps below.

To have a coding assistant do this for you, use the \`crumb-adopt-existing-project\`
skill (installed into .claude/skills, .codex/skills, and .github/skills by
\`bun run install:skills\`).

## Steps

${steps}

## Notes

- Crumb builds the interface from a single \`uiScript\` entry with no dev server.
  A framework build must be adjusted to produce browser code Bun can bundle from
  that one entry.
- src/kit/ is template-owned; a normal application does not modify it.
- The full walkthrough is docs/how-to-build-a-desktop-app-with-bun.md.
`;
}

async function crumbSource(repositoryRoot: string): Promise<{ version: string; sha: string }> {
  let version = "unknown";
  try {
    const manifest = JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    ) as { version?: string };
    if (manifest.version) version = manifest.version;
  } catch {
    // Leave the default.
  }

  let sha = "unknown";
  try {
    const result = Bun.spawnSync(["git", "-C", repositoryRoot, "rev-parse", "--short", "HEAD"]);
    if (result.success) sha = result.stdout.toString().trim() || "unknown";
  } catch {
    // Leave the default.
  }
  return { version, sha };
}

export interface StagedEntry {
  /** Path relative to the staging directory, POSIX-separated. */
  path: string;
  outcome: "copied" | "would-copy" | "skipped";
}

export interface RunResult {
  exitCode: number;
  lines: string[];
}

async function copyInto(
  destination: string,
  contents: Uint8Array | string,
  dryRun: boolean,
): Promise<"copied" | "would-copy" | "skipped"> {
  const buffer = typeof contents === "string" ? Buffer.from(contents, "utf8") : Buffer.from(contents);
  let existing: Buffer | null = null;
  try {
    existing = await readFile(destination);
  } catch {
    existing = null;
  }
  if (existing && existing.equals(buffer)) return "skipped";
  if (dryRun) return "would-copy";
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, buffer);
  return "copied";
}

/**
 * The command line. Resolves and validates everything before writing so a bad
 * invocation writes nothing.
 */
export async function runExtract(
  argv: readonly string[],
  repositoryRoot = process.cwd(),
): Promise<RunResult> {
  const lines: string[] = [];
  const root = resolve(repositoryRoot);

  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
    await assertCrumbClone(root);
  } catch (error: unknown) {
    return { exitCode: 1, lines: [error instanceof Error ? error.message : String(error)] };
  }

  const dest = isAbsolute(args.dest) ? args.dest : resolve(process.cwd(), args.dest);
  if (!(await isDirectory(dest))) {
    return { exitCode: 1, lines: [`--dest "${args.dest}" is not an existing directory.`] };
  }

  const destReal = resolve(dest);
  if (destReal === root || destReal.startsWith(root + sep)) {
    return { exitCode: 1, lines: [`--dest "${args.dest}" is inside the Crumb clone. Point it at a separate project.`] };
  }

  const staging = join(destReal, STAGING_DIRNAME);
  if (await isDirectory(staging)) {
    const present = await readdir(staging);
    if (present.length > 0 && !args.force) {
      return {
        exitCode: 1,
        lines: [
          `${STAGING_DIRNAME}/ already exists in the target and is not empty.`,
          "Re-run with --force to overwrite the files this command stages (other files there are left alone),",
          `or remove ${join(args.dest, STAGING_DIRNAME)} first.`,
        ],
      };
    }
  }

  const planned = await plannedFiles(root);
  const source = await crumbSource(root);
  const staged: StagedEntry[] = [];

  try {
    for (const file of planned) {
      const outcome = await copyInto(join(staging, file.relative), await readFile(file.source), args.dryRun);
      staged.push({ path: file.relative, outcome });
    }

    const fragments: [string, string][] = [
      ["fragments/package.json", await packageJsonFragment(root)],
      ["fragments/gitignore", GITIGNORE_FRAGMENT],
      ["fragments/app.config.ts", APP_CONFIG_FRAGMENT],
      ["MERGE.md", mergeInstructions(source)],
    ];
    for (const [relativePath, contents] of fragments) {
      const outcome = await copyInto(join(staging, relativePath), contents, args.dryRun);
      staged.push({ path: relativePath, outcome });
    }
  } catch (error: unknown) {
    const written = staged.filter((entry) => entry.outcome === "copied").map((entry) => entry.path);
    return {
      exitCode: 1,
      lines: [
        error instanceof Error ? error.message : String(error),
        written.length > 0
          ? `Partially written under ${join(args.dest, STAGING_DIRNAME)}: ${written.join(", ")}`
          : "Nothing was written.",
      ],
    };
  }

  for (const entry of staged) lines.push(`  ${entry.outcome.padEnd(10)} ${STAGING_DIRNAME}/${entry.path}`);

  const counts = staged.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.outcome] = (totals[entry.outcome] ?? 0) + 1;
    return totals;
  }, {});
  const summary = Object.entries(counts).map(([outcome, count]) => `${count} ${outcome}`).join(", ");
  lines.push(
    args.dryRun
      ? `Would stage ${staged.length} file(s) into ${join(args.dest, STAGING_DIRNAME)}/ (${summary}).`
      : `Staged ${staged.length} file(s) into ${join(args.dest, STAGING_DIRNAME)}/ (${summary}).`,
  );

  lines.push("", "Next steps (also written to MERGE.md):");
  MERGE_STEPS.forEach((step, index) => lines.push(`  ${index + 1}. ${step.title}`));

  return { exitCode: 0, lines };
}

if (import.meta.main) {
  const result = await runExtract(Bun.argv.slice(2));
  for (const line of result.lines) console.log(line);
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
