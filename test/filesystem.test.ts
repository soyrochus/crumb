import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getLocations, inspectEntry, listDirectory } from "../src/host/filesystem";

const temporary: string[] = [];
async function fixture(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "crumb-test-"));
  temporary.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("entry inspection and listing", () => {
  test("reports ordinary entries, hidden files, symlinks, and broken links", async () => {
    const root = await fixture();
    await mkdir(join(root, "folder"));
    await writeFile(join(root, "file10.txt"), "ten");
    await writeFile(join(root, "file2.txt"), "two");
    await writeFile(join(root, ".secret"), "hidden");
    await symlink("folder", join(root, "folder-link"));
    await symlink("missing", join(root, "broken-link"));

    const hidden = await listDirectory(root, false);
    expect(hidden.entries.map((entry) => entry.name)).not.toContain(".secret");
    expect(hidden.entries.map((entry) => entry.name)).toEqual(["folder", "folder-link", "file2.txt", "file10.txt", "broken-link"]);
    expect((await inspectEntry(join(root, "folder-link"))).targetKind).toBe("directory");
    expect((await inspectEntry(join(root, "broken-link"))).broken).toBe(true);
    expect((await listDirectory(root, true)).entries.some((entry) => entry.hidden)).toBe(true);
  });

  test("caps immediate enumeration and signals truncation", async () => {
    const root = await fixture();
    for (let index = 0; index < 4; index++) await writeFile(join(root, `file${index}`), "x");
    const listing = await listDirectory(root, false, 3);
    expect(listing.entries).toHaveLength(3);
    expect(listing.truncated).toBe(true);
  });

  test("rejects missing paths and does not recurse", async () => {
    const root = await fixture();
    await mkdir(join(root, "folder", "nested"), { recursive: true });
    expect((await listDirectory(root, false)).entries).toHaveLength(1);
    await expect(listDirectory(join(root, "missing"), false)).rejects.toBeDefined();
  });
});

describe("locations", () => {
  test("includes root and existing conventional home directories once", async () => {
    const home = await fixture();
    await mkdir(join(home, "Documents"));
    const locations = await getLocations("linux", home);
    expect(locations.some((location) => location.kind === "home" && location.path === home)).toBe(true);
    expect(locations.some((location) => location.kind === "root" && location.path === "/")).toBe(true);
    expect(locations.some((location) => location.label === "Documents")).toBe(true);
    expect(new Set(locations.map((location) => location.path)).size).toBe(locations.length);
  });

  test("falls back to root for an invalid home", async () => {
    const locations = await getLocations("macos", "/definitely/not/a/home");
    expect(locations.some((location) => location.kind === "home")).toBe(false);
    expect(locations.some((location) => location.path === "/")).toBe(true);
  });
});
