import { invoke } from "../../kit/ui/bridge";
import type { DirectoryListing, ExplorerOperations, Location, PlatformInfo, Preview } from "../shared/contracts";

function call<K extends keyof ExplorerOperations & string>(
  method: K,
  input: ExplorerOperations[K]["input"],
): Promise<ExplorerOperations[K]["output"]> {
  return invoke<ExplorerOperations, K>(method, input);
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function assertListing(value: unknown): asserts value is DirectoryListing {
  if (!object(value) || typeof value.path !== "string" || !Array.isArray(value.entries) || typeof value.truncated !== "boolean") throw new Error("Invalid directory response");
}
function assertPreview(value: unknown): asserts value is Preview {
  if (!object(value) || !["directory", "text", "image", "generic"].includes(String(value.type)) || !object(value.details)) throw new Error("Invalid preview response");
}

export const rpc = {
  platform: () => call("getPlatformInfo", {}).then((value) => value as PlatformInfo),
  locations: () => call("getLocations", {}).then((value) => value as Location[]),
  async list(path: string, showHidden: boolean) { const value = await call("listDirectory", { path, showHidden }); assertListing(value); return value; },
  async preview(path: string) { const value = await call("getPreview", { path }); assertPreview(value); return value; },
};
