import { describe, expect, test } from "bun:test";
import { validators } from "../src/shared/validators";

const valid = {
  width: 800,
  height: 600,
  centerX: -0.5,
  centerY: 0,
  scale: 3.5,
  maxIterations: 320,
  mode: "mandelbrot",
  juliaReal: -0.8,
  juliaImaginary: 0.156,
};

describe("Crumbbrot render validation", () => {
  test("accepts a bounded Mandelbrot or Julia viewport", () => {
    expect(validators.renderFractal(valid)).toEqual(valid);
    expect(validators.renderFractal({ ...valid, mode: "julia" }).mode).toBe("julia");
  });

  test("rejects malformed dimensions, iteration limits, and unknown keys", () => {
    for (const input of [
      { ...valid, width: 0 },
      { ...valid, width: 2048, height: 2048 },
      { ...valid, maxIterations: 2_001 },
      { ...valid, mode: "burning-ship" },
      { ...valid, extra: true },
    ]) expect(() => validators.renderFractal(input)).toThrow();
  });

  test("rejects non-finite viewport and Julia values", () => {
    for (const input of [
      { ...valid, centerX: Number.NaN },
      { ...valid, centerY: Number.POSITIVE_INFINITY },
      { ...valid, scale: 0 },
      { ...valid, juliaReal: 3 },
      { ...valid, juliaImaginary: "0.1" },
    ]) expect(() => validators.renderFractal(input)).toThrow();
  });
});
