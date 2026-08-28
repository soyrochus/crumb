import type { ProcessDetails, ProcessSummary, SystemSnapshot } from "../shared/contracts";

export type SortColumn = "identifier" | "name" | "cpuPercent" | "memoryBytes" | "state";
export type SortDirection = "ascending" | "descending";

export interface MonitorServices {
  snapshot(): Promise<SystemSnapshot>;
  processes(): Promise<ProcessSummary[]>;
  details(identifier: number): Promise<ProcessDetails | null>;
}

export function processNameText(name: string): string {
  return name;
}

export function formatPercent(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)} %`;
}

export function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) { scaled /= 1024; unit++; }
  return `${scaled >= 10 || unit === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[unit]}`;
}

export function formatLoad(value: number | null): string {
  return value === null ? "Unavailable" : value.toFixed(2);
}

export function sortedProcesses(processes: readonly ProcessSummary[], column: SortColumn, direction: SortDirection): ProcessSummary[] {
  const factor = direction === "ascending" ? 1 : -1;
  return processes.map((process, index) => ({ process, index })).sort((left, right) => {
    const a = left.process[column];
    const b = right.process[column];
    if (a === b) return left.index - right.index;
    if (a === null) return 1;
    if (b === null) return -1;
    const comparison = typeof a === "string" && typeof b === "string"
      ? a.localeCompare(b, undefined, { sensitivity: "base" })
      : Number(a) - Number(b);
    return comparison * factor;
  }).map(({ process }) => process);
}

export class ActivityMonitorState {
  snapshot: SystemSnapshot | null = null;
  processes: ProcessSummary[] = [];
  details: ProcessDetails | null = null;
  selectedIdentifier: number | null = null;
  sortColumn: SortColumn = "cpuPercent";
  sortDirection: SortDirection = "descending";
  loading = false;
  detailLoading = false;
  error: string | null = null;
  autoRefresh = false;
  private refreshGeneration = 0;
  private detailGeneration = 0;

  constructor(private readonly services: MonitorServices) {}

  get sortedProcesses(): ProcessSummary[] {
    return sortedProcesses(this.processes, this.sortColumn, this.sortDirection);
  }

  sort(column: SortColumn): void {
    if (column === this.sortColumn) {
      this.sortDirection = this.sortDirection === "ascending" ? "descending" : "ascending";
    } else {
      this.sortColumn = column;
      this.sortDirection = column === "name" || column === "state" ? "ascending" : "descending";
    }
  }

  async refresh(): Promise<boolean> {
    if (this.loading) return false;
    const generation = ++this.refreshGeneration;
    this.loading = true;
    this.error = null;
    try {
      const [snapshot, processes] = await Promise.all([this.services.snapshot(), this.services.processes()]);
      if (generation !== this.refreshGeneration) return false;
      this.snapshot = snapshot;
      this.processes = processes;
      if (this.selectedIdentifier !== null && !processes.some(({ identifier }) => identifier === this.selectedIdentifier)) {
        this.selectedIdentifier = null;
        this.details = null;
      }
      return true;
    } catch (error: unknown) {
      if (generation === this.refreshGeneration) this.error = error instanceof Error ? error.message : "System information is unavailable.";
      return false;
    } finally {
      if (generation === this.refreshGeneration) this.loading = false;
    }
  }

  async select(identifier: number | null): Promise<boolean> {
    const generation = ++this.detailGeneration;
    this.selectedIdentifier = identifier;
    this.details = null;
    this.detailLoading = identifier !== null;
    if (identifier === null) return true;
    try {
      const details = await this.services.details(identifier);
      if (generation !== this.detailGeneration || identifier !== this.selectedIdentifier) return false;
      this.details = details;
      return details !== null;
    } catch (error: unknown) {
      if (generation === this.detailGeneration) this.error = error instanceof Error ? error.message : "Process details are unavailable.";
      return false;
    } finally {
      if (generation === this.detailGeneration) this.detailLoading = false;
    }
  }

  invalidate(): void {
    this.refreshGeneration++;
    this.detailGeneration++;
  }
}
