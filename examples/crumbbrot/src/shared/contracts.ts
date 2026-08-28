export type FractalMode = "mandelbrot" | "julia";

export interface RenderFractalInput {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  scale: number;
  maxIterations: number;
  mode: FractalMode;
  juliaReal: number;
  juliaImaginary: number;
}

/**
 * Crumb's page transport is JSON-only. Rust returns a native Buffer to the Bun
 * host; the trusted handler encodes it compactly rather than expanding it into
 * an array of pixel numbers for the serializable page contract.
 */
export interface RenderFractalOutput {
  width: number;
  height: number;
  pixelsBase64: string;
  renderTimeMs: number;
}

export type CrumbbrotOperations = {
  renderFractal: { input: RenderFractalInput; output: RenderFractalOutput };
};
