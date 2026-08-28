import type { Operations } from "./transport";

/**
 * The contract an application's `app.config.ts` fulfils. Defined by the kit so
 * that kit code depends on this shape and never on a particular application.
 */
export interface ApplicationConfig {
  name: string;
  window: {
    title: string;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
  };
  csp: string;
  entries: {
    hostMain: string;
    uiScript: string;
    uiDocument: string;
    uiStyles: string;
  };
  outputStem: string;
  operations: Operations;
}
