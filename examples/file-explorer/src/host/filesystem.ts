import { access, lstat, opendir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, extname, join, normalize } from "node:path";
import { homedir } from "node:os";
import type { DirectoryEntry, DirectoryListing, EntryKind, Location, TargetKind } from "../shared/contracts";

export const DIRECTORY_LIMIT = 50_000;

function statKind(value: { isDirectory(): boolean; isFile(): boolean }): TargetKind {
  return value.isDirectory() ? "directory" : value.isFile() ? "file" : "other";
}

function iso(milliseconds: number): string | null {
  return Number.isFinite(milliseconds) && milliseconds > 0 ? new Date(milliseconds).toISOString() : null;
}

export async function inspectEntry(path: string, name = basename(path)): Promise<DirectoryEntry> {
  const info = await lstat(path);
  let kind: EntryKind = info.isSymbolicLink() ? "symlink" : statKind(info);
  let targetKind: TargetKind | null = null;
  let broken = false;
  if (kind === "symlink") {
    try {
      targetKind = statKind(await stat(path));
    } catch {
      broken = true;
    }
  }
  let readable = true;
  try {
    await access(path, constants.R_OK);
  } catch {
    readable = false;
  }
  const suffix = kind === "directory" ? "" : extname(name).slice(1).toLocaleLowerCase();
  return {
    name,
    path: normalize(path),
    kind,
    extension: suffix || null,
    size: info.isFile() ? info.size : null,
    createdAt: iso(info.birthtimeMs),
    modifiedAt: iso(info.mtimeMs),
    readable,
    hidden: name.startsWith("."),
    targetKind,
    broken,
  };
}

const category: Record<EntryKind, number> = { directory: 0, file: 1, symlink: 2, other: 3 };
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareEntries(left: DirectoryEntry, right: DirectoryEntry): number {
  const leftKind = left.kind === "symlink" && left.targetKind ? left.targetKind : left.kind;
  const rightKind = right.kind === "symlink" && right.targetKind ? right.targetKind : right.kind;
  const group = category[leftKind] - category[rightKind];
  return group || collator.compare(left.name, right.name) || left.name.localeCompare(right.name);
}

export async function listDirectory(
  path: string,
  showHidden: boolean,
  limit = DIRECTORY_LIMIT,
): Promise<DirectoryListing> {
  const entries: DirectoryEntry[] = [];
  let truncated = false;
  const directory = await opendir(path);
  for await (const dirent of directory) {
    if (!showHidden && dirent.name.startsWith(".")) continue;
    if (entries.length === limit) {
      truncated = true;
      break;
    }
    try {
      entries.push(await inspectEntry(join(path, dirent.name), dirent.name));
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT")) {
        continue;
      }
    }
  }
  entries.sort(compareEntries);
  return { path: normalize(path), entries, truncated };
}

async function existingDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function parseXdgDirectories(text: string, home: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^XDG_([A-Z]+)_DIR="(.+)"$/.exec(line.trim());
    if (!match?.[1] || !match[2]) continue;
    const expanded = match[2].replace(/^\$HOME(?=\/|$)/, home);
    if (expanded.startsWith("/")) values.set(match[1], normalize(expanded));
  }
  return values;
}

async function readXdgConfig(home: string): Promise<Map<string, string>> {
  const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config");
  try {
    return parseXdgDirectories(await Bun.file(join(configHome, "user-dirs.dirs")).slice(0, 65_536).text(), home);
  } catch {
    return new Map();
  }
}

async function childDirectories(parent: string): Promise<string[]> {
  if (!(await existingDirectory(parent))) return [];
  const values: string[] = [];
  try {
    const directory = await opendir(parent);
    for await (const child of directory) {
      if (child.isDirectory() && await existingDirectory(join(parent, child.name))) values.push(join(parent, child.name));
    }
  } catch {
    return values;
  }
  return values;
}

export async function getLocations(
  platform: "macos" | "linux",
  home = homedir(),
): Promise<Location[]> {
  const validHome = home.startsWith("/") && await existingDirectory(home) ? normalize(home) : null;
  const found = new Map<string, Location>();
  const add = async (label: string, path: string, kind: Location["kind"]) => {
    const normalized = normalize(path);
    if (!found.has(normalized) && await existingDirectory(normalized)) {
      found.set(normalized, { id: `${kind}:${normalized}`, label, path: normalized, kind });
    }
  };
  if (validHome) await add("Home", validHome, "home");
  await add("Root", "/", "root");

  if (validHome) {
    const labels = ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"];
    const xdg = platform === "linux" ? await readXdgConfig(validHome) : new Map<string, string>();
    for (const label of labels) await add(label, xdg.get(label.toUpperCase()) ?? join(validHome, label), "common");
  }

  const volumeParents = platform === "macos"
    ? ["/Volumes"]
    : validHome ? [join("/run/media", basename(validHome)), join("/media", basename(validHome)), "/mnt"] : ["/mnt"];
  for (const parent of volumeParents) {
    for (const path of await childDirectories(parent)) await add(basename(path), path, "volume");
  }
  return [...found.values()];
}
