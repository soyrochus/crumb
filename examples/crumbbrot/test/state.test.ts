import { describe, expect, test } from "bun:test";
import type { RenderFractalInput, RenderFractalOutput } from "../src/shared/contracts";
import { canvasPointToComplex, DEFAULT_VIEWPORT, panViewport, RenderCoordinator, zoomViewport } from "../src/ui/state";

const input = (centerX: number): RenderFractalInput => ({
  width: 64,
  height: 48,
  centerX,
  centerY: 0,
  scale: 3.5,
  maxIterations: 100,
  mode: "mandelbrot",
  juliaReal: 0,
  juliaImaginary: 0,
});

const output = (width: number): RenderFractalOutput => ({
  width,
  height: 1,
  pixelsBase64: "AAAAAA==",
  renderTimeMs: 1,
});

describe("viewport mapping", () => {
  test("maps the canvas center to the viewport center", () => {
    expect(canvasPointToComplex(DEFAULT_VIEWPORT, 400, 300, 800, 600)).toEqual({ real: -0.5, imaginary: 0 });
  });

  test("zooms toward the pointer and pans in complex-plane units", () => {
    const pointer = canvasPointToComplex(DEFAULT_VIEWPORT, 200, 150, 800, 600);
    const zoomed = zoomViewport(DEFAULT_VIEWPORT, 200, 150, 800, 600, 0.5);
    expect(canvasPointToComplex(zoomed, 200, 150, 800, 600)).toEqual(pointer);
    expect(zoomed.scale).toBe(1.75);
    expect(panViewport(DEFAULT_VIEWPORT, 80, -40, 800)).toEqual({ centerX: -0.85, centerY: 0.175, scale: 3.5 });
  });
});

describe("render scheduling", () => {
  test("coalesces queued work and never displays an obsolete render", async () => {
    const resolvers: Array<(value: RenderFractalOutput) => void> = [];
    let active = 0;
    let maximumActive = 0;
    const displayed: number[] = [];
    const coordinator = new RenderCoordinator(
      () => new Promise((resolve) => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        resolvers.push((value) => { active--; resolve(value); });
      }),
      (frame) => displayed.push(frame.width),
      () => undefined,
    );

    coordinator.request(input(0));
    coordinator.request(input(1));
    coordinator.request(input(2));
    expect(resolvers).toHaveLength(1);
    resolvers[0]!(output(1));
    await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    resolvers[1]!(output(2));
    await Promise.resolve();
    await Promise.resolve();

    expect(maximumActive).toBe(1);
    expect(displayed).toEqual([2]);
  });
});
