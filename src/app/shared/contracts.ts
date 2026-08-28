import type { PlatformInfo } from "../../kit/host/platform";
import type { DomainError, Result } from "../../kit/shared/transport";

export type { DomainError, PlatformInfo, Result };

export type EntryKind = "directory" | "file" | "symlink" | "other";
export type TargetKind = Exclude<EntryKind, "symlink">;

export interface Location {
  id: string;
  label: string;
  path: string;
  kind: "home" | "root" | "common" | "volume";
}

export interface ItemDetails {
  name: string;
  path: string;
  kind: EntryKind;
  extension: string | null;
  size: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  readable: boolean;
  hidden: boolean;
  targetKind: TargetKind | null;
  broken: boolean;
}

export type DirectoryEntry = ItemDetails;

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  truncated: boolean;
}

export interface DirectoryPreview {
  type: "directory";
  details: ItemDetails;
  childCount: number | null;
  childCountTruncated: boolean;
}

export interface TextPreview {
  type: "text";
  details: ItemDetails;
  content: string;
  bytesRead: number;
  totalBytes: number;
  truncated: boolean;
}

export interface ImagePreview {
  type: "image";
  details: ItemDetails;
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  dataUrl: string | null;
  tooLarge: boolean;
}

export interface GenericPreview {
  type: "generic";
  details: ItemDetails;
  reason?: "unsupported" | "binary" | "too-large" | "unavailable";
}

export type Preview = DirectoryPreview | TextPreview | ImagePreview | GenericPreview;

/** The operations this application declares. The kit is generic over this map. */
export type ExplorerOperations = {
  getPlatformInfo: { input: Record<string, never>; output: PlatformInfo };
  getLocations: { input: Record<string, never>; output: Location[] };
  listDirectory: { input: { path: string; showHidden: boolean }; output: DirectoryListing };
  getPreview: { input: { path: string }; output: Preview };
};

export type ExplorerOperation = keyof ExplorerOperations;
