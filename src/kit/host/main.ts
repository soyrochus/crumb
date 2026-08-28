import getNativeBinding from "app:native";
import UI_HTML from "app:ui";
import type { ApplicationConfig } from "../shared/config";
import { getPlatformInfo, StartupConfigurationError, startupErrorMessage } from "./platform";
import { createRpcRouter, type RpcRequest } from "./rpc";

/**
 * Opens the application's window and serves its declared operations. The kit
 * receives the configuration; it never imports an application module, so
 * `src/app/` can be replaced wholesale without touching this file.
 */
export function startApplication(config: ApplicationConfig): void {
  let closing = false;
  const { NativeWindow, loadHtmlOrigin } = getNativeBinding();
  const route = createRpcRouter(config.operations);

  try {
    if (process.platform === "linux") {
      if (process.env.GDK_BACKEND && process.env.GDK_BACKEND !== "wayland") {
        throw new StartupConfigurationError("This application requires native Wayland; unset GDK_BACKEND or set it to 'wayland'. X11/XWayland is unsupported.");
      }
      process.env.GDK_BACKEND = "wayland";
    }
    getPlatformInfo();
    const window = new NativeWindow({
      title: config.window.title,
      width: config.window.width,
      height: config.window.height,
      minWidth: config.window.minWidth,
      minHeight: config.window.minHeight,
      resizable: config.window.resizable,
      devtools: false,
      incognito: true,
      trustedOrigins: [loadHtmlOrigin()],
      allowedHosts: ["nativewindow.localhost"],
      csp: config.csp,
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
}
