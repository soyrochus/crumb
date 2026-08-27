import type { DirectoryEntry, ItemDetails, Preview } from "../shared/contracts";
import { rpc } from "./client";
import { ExplorerState } from "./state";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const locationsElement = byId<HTMLElement>("locations");
const entriesElement = byId<HTMLElement>("entries");
const previewElement = byId<HTMLElement>("preview");
const statusElement = byId<HTMLElement>("status");
const pathElement = byId<HTMLOutputElement>("path");
const hiddenButton = byId<HTMLButtonElement>("hidden");
const state = new ExplorerState("/", { listDirectory: rpc.list, getPreview: rpc.preview });
let primaryModifier: "Meta" | "Control" = "Control";

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}

function formatSize(size: number | null): string {
  if (size === null) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function renderLocations(): void {
  locationsElement.replaceChildren();
  for (const location of state.locations) {
    const button = text("button", `${location.kind === "volume" ? "◉" : "□"} ${location.label}`, "location");
    button.type = "button";
    if (location.path === state.currentDirectory) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => void state.open(location.path).then(render));
    locationsElement.append(button);
  }
}

function row(entry: DirectoryEntry): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(entry.path === state.selectedPath));
  button.dataset.path = entry.path;
  button.dataset.directory = String(entry.kind === "directory" || entry.targetKind === "directory");
  button.setAttribute("aria-label", `${entry.name}, ${entry.kind}`);
  button.append(text("span", entry.kind === "directory" || entry.targetKind === "directory" ? "📁" : "📄"), text("span", entry.name, "name"), text("span", formatSize(entry.size), "meta"));
  button.addEventListener("click", () => void state.select(entry.path).then(render));
  button.addEventListener("dblclick", () => { if (button.dataset.directory === "true") void state.open(entry.path).then(render); });
  return button;
}

function detailList(details: ItemDetails): HTMLDListElement {
  const list = document.createElement("dl");
  const fields: [string, string][] = [
    ["Name", details.name], ["Kind", details.kind], ["Extension", details.extension ?? "—"],
    ["Size", formatSize(details.size)], ["Created", details.createdAt ? new Date(details.createdAt).toLocaleString() : "—"],
    ["Modified", details.modifiedAt ? new Date(details.modifiedAt).toLocaleString() : "—"], ["Path", details.path],
  ];
  if (details.kind === "symlink") fields.push(["Link target", details.broken ? "Broken" : details.targetKind ?? "Unknown"]);
  for (const [label, value] of fields) list.append(text("dt", label), text("dd", value));
  return list;
}

function renderPreview(preview: Preview | null): void {
  previewElement.replaceChildren();
  if (!preview) { previewElement.append(text("p", state.previewLoading ? "Loading preview…" : "Select an item to preview it.")); return; }
  previewElement.append(text("h2", preview.details.name));
  if (preview.type === "text") previewElement.append(text("pre", preview.content), text("p", preview.truncated ? `Showing ${formatSize(preview.bytesRead)} of ${formatSize(preview.totalBytes)}` : formatSize(preview.totalBytes)));
  if (preview.type === "image") {
    if (preview.dataUrl) { const image = document.createElement("img"); image.src = preview.dataUrl; image.alt = `Preview of ${preview.details.name}`; previewElement.append(image); }
    else previewElement.append(text("p", "This image is too large for inline preview."));
  }
  if (preview.type === "directory") previewElement.append(text("p", preview.childCount === null ? "Contents unavailable" : `${preview.childCount}${preview.childCountTruncated ? "+" : ""} direct items`));
  previewElement.append(detailList(preview.details));
}

function render(): void {
  pathElement.value = state.currentDirectory;
  hiddenButton.setAttribute("aria-pressed", String(state.showHidden));
  hiddenButton.setAttribute("aria-label", state.showHidden ? "Hide hidden files" : "Show hidden files");
  hiddenButton.textContent = state.showHidden ? "Hidden: On" : "Hidden: Off";
  byId<HTMLButtonElement>("back").disabled = state.backHistory.length === 0;
  byId<HTMLButtonElement>("forward").disabled = state.forwardHistory.length === 0;
  entriesElement.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const entry of state.listing?.entries ?? []) fragment.append(row(entry));
  entriesElement.append(fragment);
  if (!state.directoryLoading && (state.listing?.entries.length ?? 0) === 0) entriesElement.append(text("p", "This directory is empty."));
  renderLocations();
  renderPreview(state.preview);
  statusElement.textContent = state.error?.message ?? (state.directoryLoading ? "Loading…" : `${state.listing?.entries.length ?? 0} items${state.listing?.truncated ? " (truncated)" : ""}${state.selectedPath ? ` · ${state.selectedPath}` : ""}`);
}

function toggleHidden(): void {
  const refresh = state.toggleHidden();
  render();
  void refresh.then(render);
}

byId("back").addEventListener("click", () => void state.back().then(render));
byId("forward").addEventListener("click", () => void state.forward().then(render));
byId("parent").addEventListener("click", () => void state.parent().then(render));
hiddenButton.addEventListener("click", toggleHidden);

entriesElement.addEventListener("keydown", (event) => {
  const rows = [...entriesElement.querySelectorAll<HTMLButtonElement>(".entry")];
  const current = document.activeElement instanceof HTMLButtonElement ? rows.indexOf(document.activeElement) : -1;
  const focus = (index: number) => rows[Math.max(0, Math.min(rows.length - 1, index))]?.focus();
  if (event.key === "ArrowDown") focus(current + 1);
  else if (event.key === "ArrowUp") focus(current < 0 ? 0 : current - 1);
  else if (event.key === "Home") focus(0);
  else if (event.key === "End") focus(rows.length - 1);
  else if (event.key === "Escape") { state.clearSelection(); render(); entriesElement.focus(); }
  else if (event.key === "Enter" && current >= 0) rows[current]?.dispatchEvent(new MouseEvent(rows[current]?.dataset.directory === "true" ? "dblclick" : "click"));
  else return;
  event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  const primary = primaryModifier === "Meta" ? event.metaKey : event.ctrlKey;
  if (!primary) return;
  if (event.key === "ArrowUp") void state.parent().then(render);
  else if (event.key === "[") void state.back().then(render);
  else if (event.key === "]") void state.forward().then(render);
  else if (event.key === "." && event.shiftKey) toggleHidden();
  else return;
  event.preventDefault();
});

for (const [index, splitter] of [...document.querySelectorAll<HTMLElement>(".splitter")].entries()) {
  const change = (delta: number) => {
    if (index === 0) state.navigationWidth = Math.max(150, state.navigationWidth + delta);
    else state.previewWidth = Math.max(240, state.previewWidth - delta);
    document.documentElement.style.setProperty("--nav", `${state.navigationWidth}px`);
    document.documentElement.style.setProperty("--preview", `${state.previewWidth}px`);
  };
  splitter.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { change(event.key === "ArrowLeft" ? -10 : 10); event.preventDefault(); } });
  splitter.addEventListener("pointerdown", (event) => {
    splitter.setPointerCapture(event.pointerId); let last = event.clientX;
    const move = (next: PointerEvent) => { change(next.clientX - last); last = next.clientX; };
    const up = () => { splitter.removeEventListener("pointermove", move); splitter.removeEventListener("pointerup", up); };
    splitter.addEventListener("pointermove", move); splitter.addEventListener("pointerup", up);
  });
}

void Promise.all([rpc.platform(), rpc.locations()]).then(async ([platform, locations]) => {
  primaryModifier = platform.primaryModifier;
  state.locations = locations;
  state.currentDirectory = locations.find((location) => location.kind === "home")?.path ?? "/";
  await state.initialize();
  render();
}).catch((error: unknown) => { statusElement.textContent = error instanceof Error ? error.message : "Crumb could not start."; });
