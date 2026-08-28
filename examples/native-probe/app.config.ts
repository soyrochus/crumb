import type { ApplicationConfig } from "../../src/kit/shared/config";
import { operation } from "../../src/kit/shared/transport";
import { getPlatformInfo } from "../../src/kit/host/platform";
import { expectNoKeys } from "../../src/kit/shared/validation";

async function describeHost(): Promise<Record<string, unknown>> {
  const { describeNativeHost } = await import("./handler");
  return describeNativeHost(getPlatformInfo().platform);
}

/** Permanent end-to-end fixture for the application-owned native build path. */
export const nativeProbe: ApplicationConfig = {
  name: "Crumb native extension probe",
  window: {
    title: "Crumb native extension probe",
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
  nativeExtensions: { probe: "src/app/native/probe" },
  operations: {
    describeHost: operation(expectNoKeys, describeHost),
  },
};
