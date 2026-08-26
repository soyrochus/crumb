import type { Result, RpcMethod, RpcMethods } from "../shared/contracts";
import { normalizeError, validateRpcInput } from "../shared/validation";

export const RPC_METHODS = ["getPlatformInfo", "getLocations", "listDirectory", "getPreview"] as const;

export interface RpcRequest {
  id: string;
  method: string;
  input: unknown;
}

export interface RpcResponse {
  id: string;
  result: Result<unknown>;
}

type Handler<K extends RpcMethod> = (
  input: RpcMethods[K]["input"],
) => RpcMethods[K]["output"] | Promise<RpcMethods[K]["output"]>;

export type RpcHandlers = { [K in RpcMethod]: Handler<K> };

export function isRpcMethod(value: string): value is RpcMethod {
  return (RPC_METHODS as readonly string[]).includes(value);
}

export function createRpcRouter(handlers: RpcHandlers) {
  return async (request: RpcRequest): Promise<RpcResponse> => {
    try {
      if (!isRpcMethod(request.method)) throw new Error("Unknown RPC method");
      const input = validateRpcInput(request.method, request.input);
      const handler = handlers[request.method] as (value: unknown) => unknown | Promise<unknown>;
      return { id: request.id, result: { ok: true, value: await handler(input) } };
    } catch (error: unknown) {
      return { id: request.id, result: { ok: false, error: normalizeError(error) } };
    }
  };
}
