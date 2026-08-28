import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { InvalidNativeExtensionError, validateNativeExtensionEntries, validateNativeExtensions } from "../../scripts/native-extension-config";

const roots: string[] = [];

async function fixture(manifest = '[package]\nname = "probe"\nversion = "0.1.0"\n\n[lib]\ncrate-type = ["cdylib"]\n'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crumb-native-config-"));
  roots.push(root);
  await mkdir(join(root, "native/probe"), { recursive: true });
  await writeFile(join(root, "native/probe/Cargo.toml"), manifest);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native extension declarations", () => {
  test("the field is optional", async () => {
    expect(await validateNativeExtensions("starter", {})).toEqual([]);
  });

  test("accepts source intent and derives the crate manifest", async () => {
    const root = await fixture();
    const [declaration] = await validateNativeExtensions("probe-app", { nativeExtensions: { probe: "native/probe" } }, root);
    expect(declaration?.name).toBe("probe");
    expect(declaration?.crateName).toBe("probe");
    expect(declaration?.manifestPath).toBe(join(root, "native/probe/Cargo.toml"));
  });

  test("rejects a missing directory before a build can start", async () => {
    const root = await fixture();
    await expect(validateNativeExtensions("broken-app", { nativeExtensions: { missing: "native/missing" } }, root))
      .rejects.toThrow('Application "broken-app", native extension "missing"');
  });

  test("rejects an invalid manifest", async () => {
    const root = await fixture("this is not toml = [");
    await expect(validateNativeExtensions("broken-app", { nativeExtensions: { probe: "native/probe" } }, root))
      .rejects.toThrow(InvalidNativeExtensionError);
  });

  test("rejects a duplicate logical name", async () => {
    const root = await fixture();
    await expect(validateNativeExtensionEntries("broken-app", [["probe", "native/probe"], ["probe", "native/probe"]], root))
      .rejects.toThrow("declared more than once");
  });

  test("rejects target-specific artifact paths", async () => {
    const root = await fixture();
    for (const artifact of ["native/probe.node", "native/probe-macos-arm64", "native/probe/linux-x64/libprobe.so"]) {
      await expect(validateNativeExtensions("broken-app", { nativeExtensions: { probe: artifact } }, root))
        .rejects.toThrow('Application "broken-app", native extension "probe"');
    }
  });
});
