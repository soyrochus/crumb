import { describe, expect, test } from "bun:test";
import { createRpcRouter } from "../../src/kit/host/rpc";
import { operation, type Operations } from "../../src/kit/shared/transport";

describe("narrow declared RPC surface", () => {
  const calls: string[] = [];
  const operations = {
    declared: operation(
      (raw) => { calls.push("validate"); return raw as Record<string, never>; },
      () => { calls.push("handle"); return "ok"; },
    ),
  } satisfies Operations;
  const route = createRpcRouter(operations);

  test("routes a declared operation", async () => {
    const response = await route({ id: "1", method: "declared", input: {} });
    expect(response.result).toEqual({ ok: true, value: "ok" });
  });

  test("rejects an undeclared operation without running a handler", async () => {
    calls.length = 0;
    const response = await route({ id: "2", method: "undeclared", input: {} });
    expect(response.result.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  test("does not route inherited object properties", async () => {
    for (const method of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      const response = await route({ id: "3", method, input: {} });
      expect(response.result.ok).toBe(false);
    }
  });

  test("rejects input before the handler runs", async () => {
    calls.length = 0;
    const rejecting = createRpcRouter({
      strict: operation(() => { throw new Error("invalid"); }, () => { calls.push("handle"); return "ok"; }),
    } satisfies Operations);
    const response = await rejecting({ id: "4", method: "strict", input: { bad: true } });
    expect(response.result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
