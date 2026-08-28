import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import type { ApplicationConfig } from "../src/kit/shared/config";
import { validateNativeExtensions, type NativeExtensionDeclaration } from "./native-extension-config";

export type NativeTarget = "linux-x64" | "macos-arm64";
export type NativePlatform = "linux" | "macos";
export type NativeArchitecture = "x64" | "arm64";

export interface NativeTargetIdentity {
  target: NativeTarget;
  platform: NativePlatform;
  architecture: NativeArchitecture;
}

export interface BuiltNativeExtension {
  declaration: NativeExtensionDeclaration;
  artifactPath: string;
  cacheHit: boolean;
  elapsedMs: number;
  fingerprint: string;
}

interface ArtifactMetadata {
  version: 1;
  extension: string;
  platform: NativePlatform;
  architecture: NativeArchitecture;
  sourceRoot: string;
  crateName: string;
  fingerprint: string;
  artifactSha256: string;
}

export class NativeArtifactMismatchError extends Error {}

export function nativeTargetIdentity(target: NativeTarget): NativeTargetIdentity {
  if (target === "linux-x64") return { target, platform: "linux", architecture: "x64" };
  if (target === "macos-arm64") return { target, platform: "macos", architecture: "arm64" };
  throw new Error(`Unsupported native extension target: ${String(target)}`);
}

export function nativeExtensionCacheKey(name: string, platform: NativePlatform, architecture: NativeArchitecture): string {
  return `${name}--${platform}--${architecture}`;
}

export function nativeExtensionCachePaths(declaration: NativeExtensionDeclaration, identity: NativeTargetIdentity, buildRoot = resolve(".build/native-extensions")) {
  const root = join(buildRoot, nativeExtensionCacheKey(declaration.name, identity.platform, identity.architecture));
  return {
    root,
    cargoTarget: join(root, "cargo-target"),
    artifact: join(root, `${declaration.name}.${identity.platform}-${identity.architecture}.node`),
    metadata: join(root, "artifact.json"),
  };
}

async function digest(data: string | Uint8Array): Promise<string> {
  return new Bun.CryptoHasher("sha256").update(data).digest("hex");
}

async function sourceFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "target" || entry.name === ".git" || entry.name === ".build") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

export async function nativeExtensionFingerprint(declaration: NativeExtensionDeclaration): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const path of await sourceFiles(declaration.sourceRoot)) {
    hasher.update(relative(declaration.sourceRoot, path));
    hasher.update(new Uint8Array(await readFile(path)));
  }
  return hasher.digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); }
  catch { return false; }
}

async function cachedArtifact(
  declaration: NativeExtensionDeclaration,
  identity: NativeTargetIdentity,
  fingerprint: string,
  buildRoot?: string,
): Promise<string | null> {
  const paths = nativeExtensionCachePaths(declaration, identity, buildRoot);
  if (!await exists(paths.artifact)) return null;
  if (!await exists(paths.metadata)) {
    throw new NativeArtifactMismatchError(`Refusing native extension artifact without provenance metadata: ${paths.artifact}`);
  }
  let metadata: ArtifactMetadata;
  try { metadata = JSON.parse(await readFile(paths.metadata, "utf8")) as ArtifactMetadata; }
  catch { throw new NativeArtifactMismatchError(`Refusing native extension artifact with unreadable provenance metadata: ${paths.artifact}`); }

  if (metadata.version !== 1
    || metadata.extension !== declaration.name
    || metadata.platform !== identity.platform
    || metadata.architecture !== identity.architecture
    || metadata.sourceRoot !== declaration.sourceRoot
    || metadata.crateName !== declaration.crateName) {
    throw new NativeArtifactMismatchError(`Refusing native extension artifact whose provenance does not match ${declaration.name} for ${identity.platform}-${identity.architecture}: ${paths.artifact}`);
  }
  if (metadata.fingerprint !== fingerprint) return null;
  const artifactSha256 = await digest(new Uint8Array(await readFile(paths.artifact)));
  if (artifactSha256 !== metadata.artifactSha256) {
    throw new NativeArtifactMismatchError(`Refusing modified native extension artifact: ${paths.artifact}`);
  }
  return paths.artifact;
}

function assertBuildHost(identity: NativeTargetIdentity): void {
  const platform = process.platform === "darwin" ? "macos" : process.platform;
  if (platform !== identity.platform || process.arch !== identity.architecture) {
    throw new Error(`Native extension target ${identity.target} must be built on ${identity.platform} ${identity.architecture}; this host is ${process.platform} ${process.arch}. Cross-compilation is not supported.`);
  }
}

async function runCargo(declaration: NativeExtensionDeclaration, cargoTarget: string): Promise<void> {
  const child = Bun.spawn(["cargo", "build", "--release", "--locked"], {
    cwd: declaration.sourceRoot,
    env: { ...process.env, CARGO_TARGET_DIR: cargoTarget },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Cargo failed for native extension "${declaration.name}" with exit code ${exitCode}`);
}

async function sanitizeMacInstallName(artifactPath: string, logicalName: string): Promise<void> {
  const child = Bun.spawn(["install_name_tool", "-id", `@rpath/${logicalName}.node`, artifactPath], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    const detail = await new Response(child.stderr).text();
    throw new Error(`Could not remove the build-machine install name from native extension "${logicalName}": ${detail.trim()}`);
  }
}

export async function buildNativeExtension(
  declaration: NativeExtensionDeclaration,
  target: NativeTarget,
  options: { force?: boolean; buildRoot?: string } = {},
): Promise<BuiltNativeExtension> {
  const started = performance.now();
  const identity = nativeTargetIdentity(target);
  assertBuildHost(identity);
  const paths = nativeExtensionCachePaths(declaration, identity, options.buildRoot);
  const fingerprint = await nativeExtensionFingerprint(declaration);

  if (!options.force) {
    const cached = await cachedArtifact(declaration, identity, fingerprint, options.buildRoot);
    if (cached) return { declaration, artifactPath: cached, cacheHit: true, elapsedMs: performance.now() - started, fingerprint };
  }

  // Invalidate the loadable artifact before compilation. A failed rebuild can
  // therefore never fall back to the previous binary as though it were current.
  await rm(paths.artifact, { force: true });
  await rm(paths.metadata, { force: true });
  await mkdir(paths.root, { recursive: true });
  await runCargo(declaration, paths.cargoTarget);

  const extension = identity.platform === "macos" ? "dylib" : "so";
  const produced = join(paths.cargoTarget, "release", `lib${declaration.libraryName}.${extension}`);
  if (!await exists(produced)) {
    throw new Error(`Cargo completed for native extension "${declaration.name}" but the expected cdylib was not produced: ${produced}`);
  }
  await copyFile(produced, paths.artifact);
  if (identity.platform === "macos") await sanitizeMacInstallName(paths.artifact, declaration.name);
  const artifactSha256 = await digest(new Uint8Array(await readFile(paths.artifact)));
  const metadata: ArtifactMetadata = {
    version: 1,
    extension: declaration.name,
    platform: identity.platform,
    architecture: identity.architecture,
    sourceRoot: declaration.sourceRoot,
    crateName: declaration.crateName,
    fingerprint,
    artifactSha256,
  };
  await writeFile(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
  return { declaration, artifactPath: paths.artifact, cacheHit: false, elapsedMs: performance.now() - started, fingerprint };
}

export async function buildNativeExtensions(
  applicationName: string,
  application: Pick<ApplicationConfig, "nativeExtensions">,
  target: NativeTarget,
  options: { force?: boolean; buildRoot?: string } = {},
): Promise<BuiltNativeExtension[]> {
  // Validate every declaration before starting the first build.
  const declarations = await validateNativeExtensions(applicationName, application);
  const built: BuiltNativeExtension[] = [];
  for (const declaration of declarations) built.push(await buildNativeExtension(declaration, target, options));
  return built;
}

export async function cleanNativeExtensions(
  applicationName: string,
  application: Pick<ApplicationConfig, "nativeExtensions">,
  target?: NativeTarget,
): Promise<void> {
  const declarations = await validateNativeExtensions(applicationName, application);
  for (const declaration of declarations) {
    if (target) {
      await rm(nativeExtensionCachePaths(declaration, nativeTargetIdentity(target)).root, { recursive: true, force: true });
    } else {
      const root = resolve(".build/native-extensions");
      for (const identity of [nativeTargetIdentity("macos-arm64"), nativeTargetIdentity("linux-x64")]) {
        await rm(nativeExtensionCachePaths(declaration, identity, root).root, { recursive: true, force: true });
      }
    }
  }
}

export function formatBuildMeasurement(result: BuiltNativeExtension): string {
  return `${result.declaration.name}: ${result.cacheHit ? "warm cache" : "compiled"} in ${result.elapsedMs.toFixed(1)} ms (${basename(result.artifactPath)})`;
}

export interface NativeDependencyInspection {
  dependencies: string[];
  nonSystemDependencies: string[];
}

export async function inspectNativeExtensionArtifact(result: BuiltNativeExtension): Promise<NativeDependencyInspection> {
  const platform = process.platform === "darwin" ? "macos" : process.platform;
  const command = platform === "macos" ? ["otool", "-L", result.artifactPath] : ["ldd", result.artifactPath];
  const child = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const exitCode = await child.exited;
  const output = await new Response(child.stdout).text();
  if (exitCode !== 0) throw new Error(`Could not inspect native extension "${result.declaration.name}" dependencies`);
  const lines = output.split("\n").slice(1).map((line) => line.trim()).filter(Boolean);
  const dependencies = lines
    .map((line) => line.split(" (compatibility")[0]?.split(" => ").at(-1)?.split(" (")[0]?.trim())
    .filter((value): value is string => Boolean(value));
  const nonSystemDependencies = platform === "macos"
    ? dependencies.filter((dependency) => !dependency.startsWith("/usr/lib/") && !dependency.startsWith("/System/Library/") && dependency !== `@rpath/${result.declaration.name}.node`)
    : dependencies.filter((dependency) => !dependency.startsWith("/lib/") && !dependency.startsWith("/usr/lib/") && dependency !== "linux-vdso.so.1");
  return { dependencies, nonSystemDependencies };
}
