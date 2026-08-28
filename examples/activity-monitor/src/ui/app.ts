import type { ProcessDetails, ProcessSummary } from "../shared/contracts";
import { rpc } from "./client";
import { ActivityMonitorState, formatBytes, formatLoad, formatPercent, processNameText, type SortColumn } from "./state";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const state = new ActivityMonitorState(rpc);
const processList = byId<HTMLTableSectionElement>("process-list");
const detailsElement = byId<HTMLElement>("process-details");
const detailHeading = byId<HTMLElement>("detail-heading");
const status = byId<HTMLElement>("status");
const refreshButton = byId<HTMLButtonElement>("refresh");
const autoRefresh = byId<HTMLInputElement>("auto-refresh");
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}

function row(process: ProcessSummary): HTMLTableRowElement {
  const element = document.createElement("tr");
  element.tabIndex = 0;
  element.setAttribute("aria-selected", String(process.identifier === state.selectedIdentifier));
  element.setAttribute("aria-label", `${process.name}, process ${process.identifier}`);
  element.append(
    text("td", String(process.identifier), "numeric"),
    text("td", processNameText(process.name)),
    text("td", formatPercent(process.cpuPercent), "numeric"),
    text("td", formatBytes(process.memoryBytes), "numeric"),
    text("td", process.state ?? "Unavailable"),
  );
  const select = () => { void state.select(process.identifier).then(render); render(); };
  element.addEventListener("click", select);
  element.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { select(); event.preventDefault(); } });
  return element;
}

function detailList(details: ProcessDetails): HTMLDListElement {
  const list = document.createElement("dl");
  const fields: [string, string][] = [
    ["PID", String(details.identifier)],
    ["Name", processNameText(details.name)],
    ["Parent PID", details.parentIdentifier === null ? "Unavailable" : String(details.parentIdentifier)],
    ["CPU", formatPercent(details.cpuPercent)],
    ["Memory", formatBytes(details.memoryBytes)],
    ["State", details.state ?? "Unavailable"],
    ["Executable", details.executable ?? "Unavailable"],
    ["Started", details.startedAtSeconds === null ? "Unavailable" : new Date(details.startedAtSeconds * 1000).toLocaleString()],
    ["Runtime", details.runTimeSeconds === null ? "Unavailable" : `${details.runTimeSeconds} s`],
  ];
  for (const [label, value] of fields) list.append(text("dt", label), text("dd", value));
  return list;
}

function renderDetails(): void {
  detailsElement.replaceChildren();
  if (state.detailLoading) {
    detailHeading.textContent = "Loading details…";
    detailsElement.append(text("p", "Inspecting the selected process."));
  } else if (state.details) {
    detailHeading.textContent = processNameText(state.details.name);
    detailsElement.append(detailList(state.details), text("p", "Inspection only — no process actions are exposed."));
  } else if (state.selectedIdentifier !== null) {
    detailHeading.textContent = "Process exited";
    detailsElement.append(text("p", "This process is no longer available."));
  } else {
    detailHeading.textContent = "No process selected";
    detailsElement.append(text("p", "Select a process to inspect it. This example cannot act on processes."));
  }
}

function render(): void {
  const snapshot = state.snapshot;
  byId("summary-cpu").textContent = formatPercent(snapshot?.cpuPercent ?? null);
  byId("summary-used-memory").textContent = formatBytes(snapshot?.usedMemoryBytes ?? null);
  byId("summary-total-memory").textContent = formatBytes(snapshot?.totalMemoryBytes ?? null);
  byId("summary-processes").textContent = snapshot ? `${snapshot.processCount} processes` : "Unavailable";
  byId("summary-load").textContent = snapshot ? [snapshot.loadOne, snapshot.loadFive, snapshot.loadFifteen].map(formatLoad).join(" / ") : "Unavailable";
  byId("sample-time").textContent = snapshot ? `Sampled ${new Date(snapshot.sampledAtMs).toLocaleTimeString()}` : "";
  refreshButton.disabled = state.loading;
  refreshButton.textContent = state.loading ? "Refreshing…" : "Refresh now";

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-sort]")) {
    const column = button.dataset.sort as SortColumn;
    button.removeAttribute("aria-sort");
    const label = button.textContent?.replace(/[ ↑↓]$/u, "") ?? "";
    button.textContent = label;
    if (column === state.sortColumn) {
      button.setAttribute("aria-sort", state.sortDirection);
      button.textContent = `${label} ${state.sortDirection === "ascending" ? "↑" : "↓"}`;
    }
  }
  processList.replaceChildren(...state.sortedProcesses.map(row));
  renderDetails();
  status.textContent = state.error ?? (state.loading ? "Collecting system information in a Rust worker…" : `${state.processes.length} processes · auto-refresh ${state.autoRefresh ? "on" : "off"}`);
}

function refresh(): void {
  const pending = state.refresh();
  render();
  void pending.then(render);
}

refreshButton.addEventListener("click", refresh);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-sort]")) {
  button.addEventListener("click", () => { state.sort(button.dataset.sort as SortColumn); render(); });
}
autoRefresh.addEventListener("change", () => {
  state.autoRefresh = autoRefresh.checked;
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = state.autoRefresh ? setInterval(refresh, 5_000) : null;
  render();
});
window.addEventListener("beforeunload", () => { state.invalidate(); if (autoRefreshTimer) clearInterval(autoRefreshTimer); });

refresh();
