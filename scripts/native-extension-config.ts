import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ApplicationConfig } from "../src/kit/shared/config";

export interface NativeExtensionDeclaration {
  name: string;
  sourceDirectory: string;
  sourceRoot: string;
  manifestPath: string;
  crateName: string;
  libraryName: string;
}

export class InvalidNativeExtensionError extends Error {}

const LOGICAL_NAME = /^[a-z][a-z0-9_-]*$/;
const ARTIFACT_PATH = /(?:\.(?:node|so|dylib|dll)$)|(?:^|[._/\\-])(?:linux|darwin|macos|win32)(?:[-_](?:x64|arm64|aarch64|x86_64))?(?:$|[._/\\-])/i;

function invalid(applicationName: string, logicalName: string, detail: string): InvalidNativeExtensionError {
  return new InvalidNativeExtensionError(`Application "${applicationName}", native extension "${logicalName}": ${detail}`);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

/**
 * Validate ordered entries before turning them into a lookup. Build tooling
 * uses Object.entries(config.nativeExtensions); accepting entries here also
 * makes duplicate detection explicit and independently testable.
 */
export async function validateNativeExtensionEntries(
  applicationName: string,
  entries: readonly (readonly [unknown, unknown])[],
  repositoryRoot = process.cwd(),
): Promise<NativeExtensionDeclaration[]> {
  const seen = new Set<string>();
  const declarations: NativeExtensionDeclaration[] = [];

  for (const [rawName, rawDirectory] of entries) {
    const name = typeof rawName === "string" ? rawName : String(rawName);
    if (!LOGICAL_NAME.test(name)) {
      throw invalid(applicationName, name, "logical names must start with a lowercase letter and contain only lowercase letters, digits, dash, or underscore");
    }
    if (seen.has(name)) throw invalid(applicationName, name, "logical name is declared more than once");
    seen.add(name);
    if (typeof rawDirectory !== "string" || rawDirectory.length === 0) {
      throw invalid(applicationName, name, "source directory must be a non-empty repository-relative path");
    }
    if (isAbsolute(rawDirectory)) throw invalid(applicationName, name, "source directory must be relative to the repository root");
    if (ARTIFACT_PATH.test(rawDirectory)) {
      throw invalid(applicationName, name, "declarations must name source only, not a target-specific artifact path, filename, or platform suffix");
    }

    const sourceRoot = resolve(repositoryRoot, rawDirectory);
    if (!isWithin(resolve(repositoryRoot), sourceRoot)) {
      throw invalid(applicationName, name, "source directory must remain inside the repository root");
    }
    try {
      if (!(await stat(sourceRoot)).isDirectory()) throw new Error("not a directory");
    } catch {
      throw invalid(applicationName, name, `source directory does not exist or is not a directory: ${rawDirectory}`);
    }

    const manifestPath = resolve(sourceRoot, "Cargo.toml");
    let manifest: unknown;
    try {
      manifest = Bun.TOML.parse(await readFile(manifestPath, "utf8"));
    } catch {
      throw invalid(applicationName, name, `Cargo manifest is missing, unreadable, or invalid: ${relative(repositoryRoot, manifestPath)}`);
    }
    const parsed = manifest as { package?: { name?: unknown }; lib?: { name?: unknown; "crate-type"?: unknown } };
    const crateName = parsed.package?.name;
    const crateTypes = parsed.lib?.["crate-type"];
    if (typeof crateName !== "string" || !Array.isArray(crateTypes) || !crateTypes.includes("cdylib")) {
      throw invalid(applicationName, name, "Cargo.toml must declare package.name and [lib] crate-type = [\"cdylib\"]");
    }

    const libraryName = typeof parsed.lib?.name === "string" ? parsed.lib.name : crateName.replaceAll("-", "_");
    declarations.push({ name, sourceDirectory: rawDirectory, sourceRoot, manifestPath, crateName, libraryName });
  }
  return declarations;
}

export async function validateNativeExtensions(
  applicationName: string,
  application: Pick<ApplicationConfig, "nativeExtensions">,
  repositoryRoot = process.cwd(),
): Promise<NativeExtensionDeclaration[]> {
  const configured: unknown = application.nativeExtensions;
  if (configured === undefined) return [];
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
    throw new InvalidNativeExtensionError(`Application "${applicationName}": nativeExtensions must be a logical-name to source-directory record`);
  }
  return validateNativeExtensionEntries(applicationName, Object.entries(configured), repositoryRoot);
}
