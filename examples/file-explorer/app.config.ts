import type { ApplicationConfig } from "../../src/kit/shared/config";
import { operation } from "../../src/kit/shared/transport";
import { handlers } from "./src/host/handlers";
import { validators } from "./src/shared/validators";

/**
 * The file-explorer example: a view-only three-pane file browser.
 *
 * This application restricts itself to inspection and bounded reads. That is
 * its own choice, not a limit the template imposes — `bun run verify:readonly`
 * enforces it here and nowhere else.
 */
export const fileExplorer: ApplicationConfig = {
  name: "Crumb - File explorer demo",

  window: {
    title: "Crumb - File explorer demo",
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
  },

  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  entries: {
    uiScript: "examples/file-explorer/src/ui/app.ts",
    uiDocument: "examples/file-explorer/src/ui/index.html",
    uiStyles: "examples/file-explorer/src/ui/styles.css",
  },

  operations: {
    getPlatformInfo: operation(validators.getPlatformInfo, handlers.getPlatformInfo),
    getLocations: operation(validators.getLocations, handlers.getLocations),
    listDirectory: operation(validators.listDirectory, handlers.listDirectory),
    getPreview: operation(validators.getPreview, handlers.getPreview),
  },
};
