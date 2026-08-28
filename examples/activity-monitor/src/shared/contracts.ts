export interface SystemSnapshot {
  cpuPercent: number | null;
  totalMemoryBytes: number | null;
  usedMemoryBytes: number | null;
  processCount: number;
  loadOne: number | null;
  loadFive: number | null;
  loadFifteen: number | null;
  sampledAtMs: number;
}

export interface ProcessSummary {
  identifier: number;
  name: string;
  cpuPercent: number | null;
  memoryBytes: number | null;
  state: string | null;
}

export interface ProcessDetails extends ProcessSummary {
  parentIdentifier: number | null;
  executable: string | null;
  startedAtSeconds: number | null;
  runTimeSeconds: number | null;
}

/** Every operation is inspection-only; there is deliberately no process action. */
export type ActivityMonitorOperations = {
  systemSnapshot: { input: Record<string, never>; output: SystemSnapshot };
  processList: { input: Record<string, never>; output: ProcessSummary[] };
  processDetails: { input: { identifier: number }; output: ProcessDetails | null };
};
