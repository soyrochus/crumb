import type { ApplicationConfig } from "../../src/kit/shared/config";
import { operation } from "../../src/kit/shared/transport";
import { validators } from "./src/shared/validators";

const handlers = {
  async systemSnapshot() {
    return (await import("./src/host/handlers")).handlers.systemSnapshot();
  },
  async processList() {
    return (await import("./src/host/handlers")).handlers.processList();
  },
  async processDetails(input: { identifier: number }) {
    return (await import("./src/host/handlers")).handlers.processDetails(input);
  },
};

/** A read-only system inspector backed by an application-owned Rust extension. */
export const activityMonitor: ApplicationConfig = {
  name: "Crumb - Activity monitor demo",
  window: {
    title: "Crumb - Activity monitor demo",
    width: 1180,
    height: 760,
    minWidth: 820,
    minHeight: 520,
    resizable: true,
  },
  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
  entries: {
    uiScript: "examples/activity-monitor/src/ui/app.ts",
    uiDocument: "examples/activity-monitor/src/ui/index.html",
    uiStyles: "examples/activity-monitor/src/ui/styles.css",
  },
  nativeExtensions: {
    "system-monitor": "examples/activity-monitor/native/system-monitor",
  },
  operations: {
    systemSnapshot: operation(validators.systemSnapshot, handlers.systemSnapshot),
    processList: operation(validators.processList, handlers.processList),
    processDetails: operation(validators.processDetails, handlers.processDetails),
  },
};
