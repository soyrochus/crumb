import type { Operations } from "./transport";

/**
 * The contract an application fulfils. Defined by the kit so that kit code
 * depends on this shape and never on a particular application.
 *
 * Note what is absent: there is no field that can enable WebView developer
 * tools. That flag comes from how the process was started, so a release build
 * cannot express the unsafe state.
 */
export interface ApplicationConfig {
  /** Display name of the application, used for the window title. */
  name: string;
  window: {
    title: string;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
  };
  csp: string;
  /** Entry points the build pipeline reads, relative to the repository root. */
  entries: {
    uiScript: string;
    uiDocument: string;
    uiStyles: string;
  };
  /**
   * Application-owned Rust crates, keyed by the stable logical name imported
   * as `app:ext/<name>`. Directories are relative to the repository root;
   * artifact names and target paths are deliberately not configurable.
   */
  nativeExtensions?: Record<string, string>;
  operations: Operations;
}

/**
 * The applications this repository can build. More than one may be present;
 * commands select by name and fall back to the default.
 */
export interface ApplicationRegistry {
  default: string;
  applications: Record<string, ApplicationConfig>;
}

export class UnknownApplicationError extends Error {}

/**
 * Resolves the application a command should act on. An unknown name fails
 * immediately, listing what is available, rather than building nothing useful.
 */
export function resolveApplication(registry: ApplicationRegistry, name?: string): ApplicationConfig {
  const selected = name ?? registry.default;
  const application = Object.hasOwn(registry.applications, selected)
    ? registry.applications[selected]
    : undefined;
  if (!application) {
    const available = Object.keys(registry.applications).sort().join(", ");
    throw new UnknownApplicationError(`Unknown application "${selected}". Available: ${available}`);
  }
  return application;
}

export class InvalidOutputNameError extends Error {}

const SAFE_OUTPUT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Output path for one application on one target, e.g.
 * `dist/file-explorer-macos-arm64`. The stem defaults to the selected
 * application's name, so `--example=file-explorer` builds an artifact named
 * after it; `--output=<name>` overrides that.
 *
 * The stem becomes a filename, so it is restricted to safe characters — a name
 * containing a path separator could otherwise write outside `dist/`.
 */
export function outputPath(name: string, target: string): string {
  if (!SAFE_OUTPUT_NAME.test(name)) {
    throw new InvalidOutputNameError(`Invalid output name "${name}". Use letters, digits, dot, dash, or underscore.`);
  }
  return `dist/${name}-${target}`;
}

/**
 * Reads `--output=<name>` or `--output <name>`. Returns undefined when absent,
 * so the caller falls back to the selected application's name.
 */
export function selectedOutputName(argv: readonly string[]): string | undefined {
  const index = argv.findIndex((argument) => argument === "--output" || argument.startsWith("--output="));
  if (index === -1) return undefined;
  const argument = argv[index]!;
  const value = argument.startsWith("--output=") ? argument.slice("--output=".length) : argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new InvalidOutputNameError("--output requires a name, for example: --output=my-app");
  }
  return value;
}

/**
 * Whether WebView developer tools should be enabled. Only the development
 * runner passes `devtools: true`; every other launch path omits it, so a
 * release build cannot enable diagnostics.
 */
export function devtoolsEnabled(options: { devtools?: boolean } = {}): boolean {
  return options.devtools === true;
}

export class MissingApplicationNameError extends Error {}

/**
 * Reads `--example=<name>` or `--example <name>` from a command line.
 * Returns undefined when the flag is absent, so the caller falls back to the
 * default. A bare `--example` with no value is an error rather than a silent
 * fallback — selecting the wrong application quietly is worse than failing.
 */
export function selectedApplicationName(argv: readonly string[]): string | undefined {
  const index = argv.findIndex((argument) => argument === "--example" || argument.startsWith("--example="));
  if (index === -1) return undefined;
  const argument = argv[index]!;
  const value = argument.startsWith("--example=") ? argument.slice("--example=".length) : argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new MissingApplicationNameError("--example requires an application name, for example: --example=file-explorer");
  }
  return value;
}
