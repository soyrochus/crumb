import { describe, expect, test } from "bun:test";
import type { ProcessDetails, ProcessSummary, SystemSnapshot } from "../src/shared/contracts";
import { ActivityMonitorState, formatBytes, formatLoad, formatPercent, processNameText, sortedProcesses } from "../src/ui/state";

const snapshot: SystemSnapshot = { cpuPercent: 12.5, totalMemoryBytes: 1024, usedMemoryBytes: 512, processCount: 2, loadOne: 1, loadFive: .5, loadFifteen: .25, sampledAtMs: 1 };
const processes: ProcessSummary[] = [
  { identifier: 2, name: "Zulu", cpuPercent: null, memoryBytes: 20, state: "Sleeping" },
  { identifier: 1, name: "alpha", cpuPercent: 9, memoryBytes: null, state: "Running" },
];
const details = (identifier: number): ProcessDetails => ({ ...processes.find((item) => item.identifier === identifier)!, parentIdentifier: null, executable: null, startedAtSeconds: null, runTimeSeconds: null });

describe("activity monitor presentation", () => {
  test("formats units and keeps unavailable distinct from zero", () => {
    expect(formatPercent(null)).toBe("Unavailable");
    expect(formatPercent(0)).toBe("0.0 %");
    expect(formatBytes(null)).toBe("Unavailable");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
    expect(formatLoad(null)).toBe("Unavailable");
  });

  test("sorts every column with unavailable values last", () => {
    expect(sortedProcesses(processes, "name", "ascending").map(({ identifier }) => identifier)).toEqual([1, 2]);
    expect(sortedProcesses(processes, "identifier", "descending").map(({ identifier }) => identifier)).toEqual([2, 1]);
    expect(sortedProcesses(processes, "cpuPercent", "descending").map(({ identifier }) => identifier)).toEqual([1, 2]);
  });

  test("preserves hostile process names for textContent rendering", () => {
    const hostile = '<script>alert("x")</script>\u0001';
    expect(processNameText(hostile)).toBe(hostile);
  });
});

describe("refresh and selection coordination", () => {
  test("does not overlap refreshes", async () => {
    let resolveSnapshot!: (value: SystemSnapshot) => void;
    let calls = 0;
    const state = new ActivityMonitorState({
      snapshot: () => { calls++; return new Promise((resolve) => { resolveSnapshot = resolve; }); },
      processes: async () => processes,
      details: async (identifier) => details(identifier),
    });
    const first = state.refresh();
    expect(await state.refresh()).toBe(false);
    expect(calls).toBe(1);
    resolveSnapshot(snapshot);
    expect(await first).toBe(true);
  });

  test("discards stale detail and invalidated refresh results", async () => {
    const detailResolvers = new Map<number, (value: ProcessDetails | null) => void>();
    let resolveSnapshot!: (value: SystemSnapshot) => void;
    const state = new ActivityMonitorState({
      snapshot: () => new Promise((resolve) => { resolveSnapshot = resolve; }),
      processes: async () => processes,
      details: (identifier) => new Promise((resolve) => detailResolvers.set(identifier, resolve)),
    });
    const firstDetail = state.select(1);
    const secondDetail = state.select(2);
    detailResolvers.get(2)?.(details(2));
    await secondDetail;
    detailResolvers.get(1)?.(details(1));
    expect(await firstDetail).toBe(false);
    expect(state.details?.identifier).toBe(2);

    const refresh = state.refresh();
    state.invalidate();
    resolveSnapshot(snapshot);
    expect(await refresh).toBe(false);
    expect(state.snapshot).toBeNull();
  });
});
