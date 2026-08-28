import type { Operations, Result } from "../shared/transport";
import { normalizeError } from "../shared/validation";

export interface RpcRequest {
  id: string;
  method: string;
  input: unknown;
}

export interface RpcResponse {
  id: string;
  result: Result<unknown>;
}

/**
 * Routes a request to one of the application's declared operations. An
 * operation absent from the table is unreachable: there is no fallback, no
 * generic binding, and no handler runs before its validator has accepted the
 * input.
 */
export function createRpcRouter(operations: Operations) {
  return async (request: RpcRequest): Promise<RpcResponse> => {
    try {
      const declared = Object.hasOwn(operations, request.method) ? operations[request.method] : undefined;
      if (!declared) throw new Error("Unknown operation");
      const input = declared.validate(request.input);
      return { id: request.id, result: { ok: true, value: await declared.handle(input) } };
    } catch (error: unknown) {
      return { id: request.id, result: { ok: false, error: normalizeError(error) } };
    }
  };
}
