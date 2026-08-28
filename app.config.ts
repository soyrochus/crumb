import type { ApplicationConfig } from "./src/kit/shared/config";
import { operation } from "./src/kit/shared/transport";
import { handlers } from "./src/app/host/handlers";
import { validators } from "./src/app/shared/validators";

/**
 * The one file a new application edits first.
 *
 * Everything the kit needs to know about this application lives here: how its
 * window is titled and sized, what document policy it runs under, which
 * operations its page may call, and where its source lives. Replace
 * `src/app/` and rewrite this file, and the rest of the template is unchanged.
 */
export const appConfig = {
  /** Display name, used for the window title and the built executable's stem. */
  name: "Crumb",

  window: {
    title: "Crumb - File explorer demo",
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
  },

  /**
   * The document policy applied to the embedded page. The kit supplies this
   * default; an application widens it only by editing this string.
   */
  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  /** Entry points the build pipeline reads. */
  entries: {
    hostMain: "main.ts",
    uiScript: "src/app/ui/app.ts",
    uiDocument: "src/app/ui/index.html",
    uiStyles: "src/app/ui/styles.css",
  },

  /** Output stem per target; the target suffix is appended by the build. */
  outputStem: "dist/crumb",

  /**
   * The operations this application's page may call. Nothing outside this table
   * is reachable from the WebView, and no handler runs before its validator has
   * accepted the input.
   */
  operations: {
    getPlatformInfo: operation(validators.getPlatformInfo, handlers.getPlatformInfo),
    getLocations: operation(validators.getLocations, handlers.getLocations),
    listDirectory: operation(validators.listDirectory, handlers.listDirectory),
    getPreview: operation(validators.getPreview, handlers.getPreview),
  },
} satisfies ApplicationConfig;

export type AppConfig = typeof appConfig;
