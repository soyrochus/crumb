import { describe, expect, test } from "bun:test";
import { ShutdownRegistry, shutdownAndExit, type ShutdownDiagnostic } from "../../src/kit/host/shutdown";

describe("bounded host shutdown", () => {
  test("runs handlers once in registration order", async () => {
    const registry = new ShutdownRegistry();
    const calls: string[] = [];
    registry.register("first", async () => { calls.push("first"); });
    registry.register("second", () => { calls.push("second"); });

    await Promise.all([registry.run(), registry.run()]);
    await registry.run();

    expect(calls).toEqual(["first", "second"]);
  });

  test("a throwing handler is reported and does not prevent the others or exit", async () => {
    const registry = new ShutdownRegistry();
    const calls: string[] = [];
    const diagnostics: ShutdownDiagnostic[] = [];
    const exits: number[] = [];
    registry.register("broken", () => { calls.push("broken"); throw new Error("boom"); });
    registry.register("healthy", () => { calls.push("healthy"); });

    await shutdownAndExit(registry, (code) => { exits.push(code); }, { report: (value) => diagnostics.push(value) });

    expect(calls).toEqual(["broken", "healthy"]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.name).toBe("broken");
    expect(exits).toEqual([0]);
  });

  test("a hanging handler is bounded, identified, and exit still runs", async () => {
    const registry = new ShutdownRegistry();
    const diagnostics: ShutdownDiagnostic[] = [];
    const exits: number[] = [];
    registry.register("stuck-extension", () => new Promise(() => undefined));
    registry.register("unreached", () => { throw new Error("must not run after the global bound"); });

    const started = performance.now();
    await shutdownAndExit(registry, (code) => { exits.push(code); }, {
      timeoutMs: 20,
      report: (value) => diagnostics.push(value),
    });

    expect(performance.now() - started).toBeLessThan(250);
    expect(diagnostics).toEqual([{ name: "stuck-extension", timedOut: true }]);
    expect(exits).toEqual([0]);
  });
});
