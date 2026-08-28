import type { ApplicationConfig } from "../kit/shared/config";
import { operation } from "../kit/shared/transport";
import { handlers } from "./host/handlers";
import { validators } from "./shared/validators";

/**
 * The minimal starting point. Edit this file and `src/app/` to build your own
 * application; nothing under `src/kit/` needs to change.
 */
export const starter: ApplicationConfig = {
  name: "Crumb starter",

  window: {
    title: "Crumb starter",
    width: 720,
    height: 520,
    minWidth: 420,
    minHeight: 320,
    resizable: true,
  },

  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  entries: {
    uiScript: "src/app/ui/app.ts",
    uiDocument: "src/app/ui/index.html",
    uiStyles: "src/app/ui/styles.css",
  },

  /** Declare an operation here and the page can call it. Nothing else is reachable. */
  operations: {
    describeHost: operation(validators.describeHost, handlers.describeHost),
  },
};
