import { describe, expect, test } from "bun:test";
import type { DirectoryListing, Preview } from "../../src/app/shared/contracts";
import { ExplorerState } from "../../src/app/ui/state";

const listing = (path: string): DirectoryListing => ({ path, entries: [], truncated: false });
const preview = (path: string): Preview => ({
  type: "generic",
  reason: "unsupported",
  details: { name: path, path, kind: "file", extension: null, size: 0, createdAt: null, modifiedAt: null, readable: true, hidden: false, targetKind: null, broken: false },
});

describe("transactional navigation state", () => {
  test("commits push, back, forward, parent, and root behavior only after success", async () => {
    const state = new ExplorerState("/a", { listDirectory: async (path) => listing(path), getPreview: async (path) => preview(path) });
    await state.initialize();
    expect(await state.open("/a/b")).toBe(true);
    expect(state.backHistory).toEqual(["/a"]);
    expect(await state.back()).toBe(true);
    expect(state.currentDirectory).toBe("/a");
    expect(await state.forward()).toBe(true);
    expect(state.currentDirectory).toBe("/a/b");
    expect(await state.parent()).toBe(true);
    expect(state.currentDirectory).toBe("/a");
    const root = new ExplorerState("/", { listDirectory: async (path) => listing(path), getPreview: async (path) => preview(path) });
    expect(await root.parent()).toBe(true);
    expect(root.backHistory).toEqual([]);
  });

  test("does not corrupt current path or history on failure", async () => {
    const state = new ExplorerState("/good", { listDirectory: async (path) => path === "/bad" ? Promise.reject(new Error()) : listing(path), getPreview: async (path) => preview(path) });
    await state.initialize();
    expect(await state.open("/bad")).toBe(false);
    expect(state.currentDirectory).toBe("/good");
    expect(state.backHistory).toEqual([]);
  });

  test("discards out-of-order directory and preview responses", async () => {
    const directories = new Map<string, (value: DirectoryListing) => void>();
    const previews = new Map<string, (value: Preview) => void>();
    const state = new ExplorerState("/", {
      listDirectory: (path) => new Promise((resolve) => directories.set(path, resolve)),
      getPreview: (path) => new Promise((resolve) => previews.set(path, resolve)),
    });
    const first = state.open("/a");
    const second = state.open("/b");
    directories.get("/b")?.(listing("/b"));
    await second;
    directories.get("/a")?.(listing("/a"));
    expect(await first).toBe(false);
    expect(state.currentDirectory).toBe("/b");

    const oldSelection = state.select("/b/old");
    const newSelection = state.select("/b/new");
    previews.get("/b/new")?.(preview("/b/new"));
    await newSelection;
    previews.get("/b/old")?.(preview("/b/old"));
    expect(await oldSelection).toBe(false);
    expect(state.preview?.details.path).toBe("/b/new");
  });

  test("clears payloads and refreshes when hidden visibility changes", async () => {
    const flags: boolean[] = [];
    const state = new ExplorerState("/", { listDirectory: async (path, hidden) => { flags.push(hidden); return listing(path); }, getPreview: async (path) => preview(path) });
    await state.initialize();
    await state.select("/file");
    expect(state.preview).not.toBeNull();
    await state.toggleHidden();
    expect(flags).toEqual([false, true]);
    expect(state.selectedPath).toBeNull();
    expect(state.preview).toBeNull();
  });
});
