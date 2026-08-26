export type SupportedPlatform = "macos" | "linux";
export type PrimaryModifier = "Meta" | "Control";
export type EntryKind = "directory" | "file" | "symlink" | "other";
export type TargetKind = Exclude<EntryKind, "symlink">;

export interface PlatformInfo {
  platform: SupportedPlatform;
  primaryModifier: PrimaryModifier;
}

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

export type DomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "NOT_DIRECTORY"
  | "UNAVAILABLE"
  | "UNSUPPORTED_PLATFORM";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

export interface RpcMethods {
  getPlatformInfo: { input: Record<string, never>; output: PlatformInfo };
  getLocations: { input: Record<string, never>; output: Location[] };
  listDirectory: { input: { path: string; showHidden: boolean }; output: DirectoryListing };
  getPreview: { input: { path: string }; output: Preview };
}

export type RpcMethod = keyof RpcMethods;
