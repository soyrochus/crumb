import getNativeBinding from "crumb:native";
import UI_HTML from "crumb:ui";
import { getLocations, listDirectory } from "./filesystem";
import { getPlatformInfo, StartupConfigurationError, startupErrorMessage } from "./platform";
import { getPreview } from "./preview";
import { createRpcRouter, type RpcHandlers, type RpcRequest } from "./rpc";

let closing = false;
const { NativeWindow, loadHtmlOrigin } = getNativeBinding();

const handlers: RpcHandlers = {
  getPlatformInfo: () => getPlatformInfo(),
  getLocations: () => getLocations(getPlatformInfo().platform),
  listDirectory: ({ path, showHidden }) => listDirectory(path, showHidden),
  getPreview: ({ path }) => getPreview(path),
};
const route = createRpcRouter(handlers);

try {
  if (process.platform === "linux") {
    if (process.env.GDK_BACKEND && process.env.GDK_BACKEND !== "wayland") {
      throw new StartupConfigurationError("Crumb requires native Wayland; unset GDK_BACKEND or set it to 'wayland'. X11/XWayland is unsupported.");
    }
    process.env.GDK_BACKEND = "wayland";
  }
  getPlatformInfo();
  const window = new NativeWindow({
    title: "Crumb",
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    devtools: false,
    incognito: true,
    trustedOrigins: [loadHtmlOrigin()],
    allowedHosts: ["nativewindow.localhost"],
    csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
  });
  window.onMessage((raw, sourceUrl) => {
    if (closing || sourceUrl !== `${loadHtmlOrigin()}/`) return;
    void (async () => {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object") return;
      const request = value as Partial<RpcRequest>;
      if (typeof request.id !== "string" || typeof request.method !== "string") return;
      const response = await route({ id: request.id, method: request.method, input: request.input });
      if (!closing) window.postMessage(JSON.stringify(response));
    })().catch(() => undefined);
  });
  window.onNavigationBlocked(() => undefined);
  window.onClose(() => { closing = true; process.exit(0); });
  window.loadHtml(UI_HTML);
} catch (error: unknown) {
  console.error(startupErrorMessage(error));
  process.exitCode = 1;
}
