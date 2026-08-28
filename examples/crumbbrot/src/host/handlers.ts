import nativeExtension from "app:ext/fractal-renderer";
import { registerShutdownHandler } from "../../../../src/kit/host/shutdown";
import type { RenderFractalInput, RenderFractalOutput } from "../shared/contracts";
import { encodePixelBuffer } from "./pixels";

interface FractalRendererExtension {
  renderFractal(input: RenderFractalInput): Promise<unknown>;
  cancelRenders(): void;
}

const native = nativeExtension as unknown as FractalRendererExtension;
registerShutdownHandler("crumbbrot native rendering", () => native.cancelRenders());

export const handlers = {
  async renderFractal(input: RenderFractalInput): Promise<RenderFractalOutput> {
    if (typeof native.renderFractal !== "function") {
      throw Object.assign(new Error('Native extension "fractal-renderer" does not export renderFractal()'), { code: "ENODEV" });
    }
    const started = performance.now();
    try {
      const pixels = await native.renderFractal(input);
      return {
        width: input.width,
        height: input.height,
        pixelsBase64: encodePixelBuffer(pixels, input.width * input.height * 4),
        renderTimeMs: performance.now() - started,
      };
    } catch (error: unknown) {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
      throw Object.assign(new Error(`Fractal rendering failed${detail}`), { code: "ENODEV" });
    }
  },
};
