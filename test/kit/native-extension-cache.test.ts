import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Every test here shells out to `cargo build --release` — some of them more than
// once. On a slow or loaded CI runner a cold Rust compile alone can approach the
// 5s default, so give the whole file a compile-sized budget.
setDefaultTimeout(180_000);
import { buildNativeExtension, inspectNativeExtensionArtifact, nativeExtensionCacheKey, nativeExtensionCachePaths, nativeTargetIdentity, NativeArtifactMismatchError, type NativeTarget } from "../../scripts/build-extensions";
import { validateNativeExtensions, type NativeExtensionDeclaration } from "../../scripts/native-extension-config";

let root: string;
let declaration: NativeExtensionDeclaration;
let buildRoot: string;
const target = (process.platform === "darwin" ? "macos-arm64" : "linux-x64") as NativeTarget;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "crumb-native-cache-"));
  await cp("src/app/native/probe", join(root, "probe"), { recursive: true });
  [declaration] = await validateNativeExtensions("cache-test", { nativeExtensions: { probe: "probe" } }, root) as [NativeExtensionDeclaration];
  buildRoot = join(root, "build");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("native extension cache safety", () => {
  test("cache keys distinguish extension, platform, and architecture", () => {
    expect(nativeExtensionCacheKey("alpha", "macos", "arm64")).not.toBe(nativeExtensionCacheKey("beta", "macos", "arm64"));
    expect(nativeExtensionCacheKey("alpha", "macos", "arm64")).not.toBe(nativeExtensionCacheKey("alpha", "linux", "arm64"));
    expect(nativeExtensionCacheKey("alpha", "linux", "arm64")).not.toBe(nativeExtensionCacheKey("alpha", "linux", "x64"));
  });

  test("unchanged source is a cache hit and changed source rebuilds", async () => {
    const cold = await buildNativeExtension(declaration, target, { buildRoot });
    const warm = await buildNativeExtension(declaration, target, { buildRoot });
    expect(cold.cacheHit).toBe(false);
    expect(warm.cacheHit).toBe(true);
    expect((await inspectNativeExtensionArtifact(cold)).nonSystemDependencies).toEqual([]);

    const source = join(declaration.sourceRoot, "src/lib.rs");
    await writeFile(source, `${await readFile(source, "utf8")}\n// staleness test\n`);
    const rebuilt = await buildNativeExtension(declaration, target, { buildRoot });
    expect(rebuilt.cacheHit).toBe(false);
    expect(rebuilt.fingerprint).not.toBe(warm.fingerprint);
  });

  test("a failed rebuild invalidates the previously loadable artifact", async () => {
    const paths = nativeExtensionCachePaths(declaration, nativeTargetIdentity(target), buildRoot);
    await writeFile(join(declaration.sourceRoot, "src/lib.rs"), "this is not rust");
    await expect(buildNativeExtension(declaration, target, { buildRoot })).rejects.toThrow("Cargo failed");
    await expect(stat(paths.artifact)).rejects.toThrow();
    await expect(stat(paths.metadata)).rejects.toThrow();
  });

  test("an artifact with mismatched target provenance is rejected", async () => {
    // Restore the fixture and establish a valid artifact first.
    await rm(declaration.sourceRoot, { recursive: true, force: true });
    await cp("src/app/native/probe", declaration.sourceRoot, { recursive: true });
    await buildNativeExtension(declaration, target, { buildRoot });
    const paths = nativeExtensionCachePaths(declaration, nativeTargetIdentity(target), buildRoot);
    const metadata = JSON.parse(await readFile(paths.metadata, "utf8")) as { platform: string };
    metadata.platform = metadata.platform === "macos" ? "linux" : "macos";
    await writeFile(paths.metadata, JSON.stringify(metadata));
    await expect(buildNativeExtension(declaration, target, { buildRoot })).rejects.toThrow(NativeArtifactMismatchError);
  });
});
