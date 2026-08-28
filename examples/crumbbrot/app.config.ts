import type { ApplicationConfig } from "../../src/kit/shared/config";
import { operation } from "../../src/kit/shared/transport";
import type { RenderFractalInput } from "./src/shared/contracts";
import { validators } from "./src/shared/validators";

// Load trusted host code lazily so configuration-only tests do not try to
// resolve the native extension outside Crumb's runner.
const handlers = {
  async renderFractal(input: RenderFractalInput) {
    return (await import("./src/host/handlers")).handlers.renderFractal(input);
  },
};

/** An interactive Mandelbrot and Julia explorer backed by Rust. */
export const crumbbrot: ApplicationConfig = {
  name: "Crumbbrot",
  window: {
    title: "Crumbbrot — Fractal explorer",
    width: 1120,
    height: 760,
    minWidth: 680,
    minHeight: 480,
    resizable: true,
  },
  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
  entries: {
    uiScript: "examples/crumbbrot/src/ui/app.ts",
    uiDocument: "examples/crumbbrot/src/ui/index.html",
    uiStyles: "examples/crumbbrot/src/ui/styles.css",
  },
  nativeExtensions: {
    "fractal-renderer": "examples/crumbbrot/native/fractal-renderer",
  },
  operations: {
    renderFractal: operation(validators.renderFractal, handlers.renderFractal),
  },
};
