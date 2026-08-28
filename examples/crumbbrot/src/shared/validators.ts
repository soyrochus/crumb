import { expectOnlyKeys, ValidationError } from "../../../../src/kit/shared/validation";
import type { FractalMode, RenderFractalInput } from "./contracts";

const keys = [
  "width",
  "height",
  "centerX",
  "centerY",
  "scale",
  "maxIterations",
  "mode",
  "juliaReal",
  "juliaImaginary",
] as const;

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ValidationError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return Number(value);
}

function finite(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ValidationError(`${name} must be a finite number between ${minimum} and ${maximum}`);
  }
  return value;
}

export const validators = {
  renderFractal(raw: unknown): RenderFractalInput {
    const input = expectOnlyKeys(raw, keys);
    const width = integer(input.width, "width", 16, 2048);
    const height = integer(input.height, "height", 16, 2048);
    if (width * height > 2_000_000) {
      throw new ValidationError("render area must not exceed 2,000,000 pixels");
    }
    if (input.mode !== "mandelbrot" && input.mode !== "julia") {
      throw new ValidationError('mode must be "mandelbrot" or "julia"');
    }
    return {
      width,
      height,
      centerX: finite(input.centerX, "centerX", -1e12, 1e12),
      centerY: finite(input.centerY, "centerY", -1e12, 1e12),
      scale: finite(input.scale, "scale", 1e-14, 8),
      maxIterations: integer(input.maxIterations, "maxIterations", 16, 2_000),
      mode: input.mode as FractalMode,
      juliaReal: finite(input.juliaReal, "juliaReal", -2.5, 2.5),
      juliaImaginary: finite(input.juliaImaginary, "juliaImaginary", -2.5, 2.5),
    };
  },
};
