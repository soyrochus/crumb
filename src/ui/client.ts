import type { DirectoryListing, Location, PlatformInfo, Preview, Result, RpcMethod, RpcMethods } from "../shared/contracts";

declare global {
  interface Window {
    ipc: { postMessage(message: string): void };
    __native_message__: (message: string) => void;
  }
}

const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>();
let nextId = 0;

window.__native_message__ = (raw) => {
  const response: unknown = JSON.parse(raw);
  if (!response || typeof response !== "object") return;
  const { id, result } = response as { id?: unknown; result?: unknown };
  if (typeof id !== "string" || !result || typeof result !== "object") return;
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  const outcome = result as Result<unknown>;
  outcome.ok ? request.resolve(outcome.value) : request.reject(new Error(outcome.error.message));
};

async function invoke<K extends RpcMethod>(method: K, input: RpcMethods[K]["input"]): Promise<RpcMethods[K]["output"]> {
  const id = String(++nextId);
  const response = new Promise<unknown>((resolve, reject) => pending.set(id, { resolve, reject }));
  window.ipc.postMessage(JSON.stringify({ id, method, input }));
  return await response as RpcMethods[K]["output"];
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function assertListing(value: unknown): asserts value is DirectoryListing {
  if (!object(value) || typeof value.path !== "string" || !Array.isArray(value.entries) || typeof value.truncated !== "boolean") throw new Error("Invalid directory response");
}
function assertPreview(value: unknown): asserts value is Preview {
  if (!object(value) || !["directory", "text", "image", "generic"].includes(String(value.type)) || !object(value.details)) throw new Error("Invalid preview response");
}

export const rpc = {
  platform: () => invoke("getPlatformInfo", {}).then((value) => value as PlatformInfo),
  locations: () => invoke("getLocations", {}).then((value) => value as Location[]),
  async list(path: string, showHidden: boolean) { const value = await invoke("listDirectory", { path, showHidden }); assertListing(value); return value; },
  async preview(path: string) { const value = await invoke("getPreview", { path }); assertPreview(value); return value; },
};
