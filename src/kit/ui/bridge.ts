import type { OperationMap, Result } from "../shared/transport";

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

/**
 * Calls one of the application's declared operations. Generic over the
 * application's operation map, so the page keeps end-to-end types across the
 * bridge while the kit knows no operation name.
 */
export async function invoke<M extends OperationMap, K extends keyof M & string>(
  method: K,
  input: M[K]["input"],
): Promise<M[K]["output"]> {
  const id = String(++nextId);
  const response = new Promise<unknown>((resolve, reject) => pending.set(id, { resolve, reject }));
  window.ipc.postMessage(JSON.stringify({ id, method, input }));
  return await response as M[K]["output"];
}
