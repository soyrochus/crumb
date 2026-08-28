import nativeExtension from "app:ext/system-monitor";
import { registerShutdownHandler } from "../../../../src/kit/host/shutdown";
import type { ProcessDetails, ProcessSummary, SystemSnapshot } from "../shared/contracts";

interface SystemMonitorExtension {
  systemSnapshot(): Promise<unknown>;
  processList(): Promise<unknown>;
  processDetails(identifier: number): Promise<unknown>;
  cancelSampling(): void;
}

const native = nativeExtension as unknown as SystemMonitorExtension;
registerShutdownHandler("activity-monitor native sampling", () => native.cancelSampling());

function record(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The native extension returned an invalid ${description}`);
  }
  return value as Record<string, unknown>;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unsigned(value: unknown, description: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid ${description} from native extension`);
  return Number(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeProcess(value: unknown): ProcessSummary {
  const item = record(value, "process");
  if (typeof item.name !== "string") throw new Error("Invalid process name from native extension");
  return {
    identifier: unsigned(item.identifier, "process identifier"),
    name: item.name,
    cpuPercent: finiteOrNull(item.cpuPercent),
    memoryBytes: finiteOrNull(item.memoryBytes),
    state: textOrNull(item.state),
  };
}

async function callNative<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error: unknown) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
    throw Object.assign(new Error(`System information is temporarily unavailable${detail}`), { code: "ENODEV" });
  }
}

export const handlers = {
  async systemSnapshot(): Promise<SystemSnapshot> {
    const value = record(await callNative(() => native.systemSnapshot()), "system snapshot");
    return {
      cpuPercent: finiteOrNull(value.cpuPercent),
      totalMemoryBytes: finiteOrNull(value.totalMemoryBytes),
      usedMemoryBytes: finiteOrNull(value.usedMemoryBytes),
      processCount: unsigned(value.processCount, "process count"),
      loadOne: finiteOrNull(value.loadOne),
      loadFive: finiteOrNull(value.loadFive),
      loadFifteen: finiteOrNull(value.loadFifteen),
      sampledAtMs: finiteOrNull(value.sampledAtMs) ?? Date.now(),
    };
  },

  async processList(): Promise<ProcessSummary[]> {
    const value = await callNative(() => native.processList());
    if (!Array.isArray(value)) throw new Error("The native extension returned an invalid process list");
    return value.map(normalizeProcess);
  },

  async processDetails({ identifier }: { identifier: number }): Promise<ProcessDetails | null> {
    const raw = await callNative(() => native.processDetails(identifier));
    if (raw === null || raw === undefined) return null;
    const value = record(raw, "process details");
    return {
      ...normalizeProcess(value),
      parentIdentifier: finiteOrNull(value.parentIdentifier),
      executable: textOrNull(value.executable),
      startedAtSeconds: finiteOrNull(value.startedAtSeconds),
      runTimeSeconds: finiteOrNull(value.runTimeSeconds),
    };
  },
};
