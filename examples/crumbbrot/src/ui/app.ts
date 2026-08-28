import type { FractalMode, RenderFractalInput, RenderFractalOutput } from "../shared/contracts";
import { rpc } from "./client";
import { canvasPointToComplex, DEFAULT_VIEWPORT, panViewport, RenderCoordinator, zoomViewport, type Viewport } from "./state";

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>("fractal");
const mode = byId<HTMLSelectElement>("mode");
const iterations = byId<HTMLInputElement>("iterations");
const juliaControls = byId<HTMLFieldSetElement>("julia-controls");
const juliaReal = byId<HTMLInputElement>("julia-real");
const juliaImaginary = byId<HTMLInputElement>("julia-imaginary");
const busy = byId<HTMLElement>("busy");
const status = byId<HTMLElement>("status");
let viewport: Viewport = { ...DEFAULT_VIEWPORT };
let dragging: { x: number; y: number } | null = null;

function boundedRenderSize(preview: boolean): { width: number; height: number } {
  const rectangle = canvas.getBoundingClientRect();
  const density = Math.min(devicePixelRatio, preview ? 0.75 : 1.5);
  let width = Math.max(16, Math.round(rectangle.width * density));
  let height = Math.max(16, Math.round(rectangle.height * density));
  const bound = Math.min(1, 2048 / width, 2048 / height, Math.sqrt(2_000_000 / (width * height)));
  width = Math.max(16, Math.floor(width * bound));
  height = Math.max(16, Math.floor(height * bound));
  return { width, height };
}

function renderInput(preview = false): RenderFractalInput {
  const size = boundedRenderSize(preview);
  return {
    ...size,
    ...viewport,
    maxIterations: Math.max(16, Math.min(2_000, Math.round(Number(iterations.value) * (preview ? 0.55 : 1)))),
    mode: mode.value as FractalMode,
    juliaReal: Number(juliaReal.value),
    juliaImaginary: Number(juliaImaginary.value),
  };
}

function decodePixels(base64: string, expectedBytes: number): Uint8ClampedArray {
  const binary = atob(base64);
  if (binary.length !== expectedBytes) throw new Error("The page received an invalid pixel buffer.");
  const bytes = new Uint8ClampedArray(expectedBytes);
  for (let index = 0; index < expectedBytes; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function display(frame: RenderFractalOutput): void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This WebView does not provide a 2D canvas context.");
  const pixels = decodePixels(frame.pixelsBase64, frame.width * frame.height * 4);
  canvas.width = frame.width;
  canvas.height = frame.height;
  context.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0);
  byId("render-time").textContent = `${frame.width}×${frame.height} · ${frame.renderTimeMs.toFixed(1)} ms`;
}

function updateReadout(): void {
  const sign = viewport.centerY < 0 ? "−" : "+";
  byId("coordinates").textContent = `center ${viewport.centerX.toFixed(8)} ${sign} ${Math.abs(viewport.centerY).toFixed(8)}i`;
  byId("zoom").textContent = `view width ${viewport.scale.toExponential(3)}`;
}

const coordinator = new RenderCoordinator(
  rpc.render,
  (frame) => {
    try {
      display(frame);
      status.textContent = `${mode.value === "julia" ? "Julia" : "Mandelbrot"} render complete`;
      status.classList.remove("error");
    } catch (error: unknown) {
      status.textContent = error instanceof Error ? error.message : "The frame could not be displayed.";
      status.classList.add("error");
    }
  },
  (rendering, error) => {
    busy.hidden = !rendering;
    if (error) {
      status.textContent = error;
      status.classList.add("error");
    } else if (rendering) {
      status.textContent = "Rendering on a native worker…";
      status.classList.remove("error");
    }
  },
);

function requestRender(preview = false): void {
  updateReadout();
  coordinator.request(renderInput(preview));
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rectangle = canvas.getBoundingClientRect();
  viewport = zoomViewport(
    viewport,
    event.clientX - rectangle.left,
    event.clientY - rectangle.top,
    rectangle.width,
    rectangle.height,
    Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.0015))),
  );
  requestRender();
}, { passive: false });

canvas.addEventListener("pointerdown", (event) => {
  dragging = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const rectangle = canvas.getBoundingClientRect();
  viewport = panViewport(viewport, event.clientX - dragging.x, event.clientY - dragging.y, rectangle.width);
  dragging = { x: event.clientX, y: event.clientY };
  requestRender(true);
});

function finishDrag(): void {
  if (!dragging) return;
  dragging = null;
  canvas.classList.remove("dragging");
  requestRender();
}
canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);

mode.addEventListener("change", () => {
  juliaControls.disabled = mode.value !== "julia";
  viewport = mode.value === "julia" ? { centerX: 0, centerY: 0, scale: 3.2 } : { ...DEFAULT_VIEWPORT };
  requestRender();
});

for (const control of [iterations, juliaReal, juliaImaginary]) {
  control.addEventListener("change", () => {
    if (!control.reportValidity()) return;
    requestRender();
  });
}

byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  viewport = mode.value === "julia" ? { centerX: 0, centerY: 0, scale: 3.2 } : { ...DEFAULT_VIEWPORT };
  requestRender();
});

const resizeObserver = new ResizeObserver(() => requestRender(true));
resizeObserver.observe(canvas);
window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  coordinator.invalidate();
});

// Keep coordinate mapping available to assistive/debug tooling without
// exposing any native capability to the page.
canvas.addEventListener("pointermove", (event) => {
  if (dragging) return;
  const rectangle = canvas.getBoundingClientRect();
  const point = canvasPointToComplex(viewport, event.clientX - rectangle.left, event.clientY - rectangle.top, rectangle.width, rectangle.height);
  canvas.title = `${point.real.toPrecision(9)} ${point.imaginary < 0 ? "−" : "+"} ${Math.abs(point.imaginary).toPrecision(9)}i`;
});

requestRender();
