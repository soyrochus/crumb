import type { NativeWindow as NativeWindowInstance, WindowOptions } from "@nativewindow/webview";

const nativeBinding = require(
  "@nativewindow/webview-linux-x64-gnu/native-window.linux-x64-gnu.node",
) as {
  NativeWindow: new (options: WindowOptions) => NativeWindowInstance;
  loadHtmlOrigin: () => string;
};
const { NativeWindow, loadHtmlOrigin } = nativeBinding;

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Crumb feasibility</title>
    <style>body{font:16px system-ui;padding:2rem;color-scheme:light dark}</style>
  </head>
  <body>
    <p id="status">Checking native RPC…</p>
    <script>
      const pending = new Map();
      let nextId = 0;

      window.__native_message__ = (raw) => {
        const response = JSON.parse(raw);
        const request = pending.get(response.id);
        if (!request) return;
        pending.delete(response.id);
        response.error ? request.reject(new Error(response.error)) : request.resolve(response.result);
      };

      function invoke(method, args = []) {
        return new Promise((resolve, reject) => {
          const id = String(++nextId);
          pending.set(id, { resolve, reject });
          window.ipc.postMessage(JSON.stringify({ id, method, args }));
        });
      }

      void invoke("ping", ["crumb"]).then((result) => {
        document.getElementById("status").textContent = result.message;
        window.ipc.postMessage(JSON.stringify({ method: "report", args: [result.message] }));
      });
    </script>
  </body>
</html>`;

try {
  const window = new NativeWindow({
    title: "Crumb feasibility",
    width: 800,
    height: 500,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    devtools: false,
    incognito: true,
    csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
    trustedOrigins: [loadHtmlOrigin()],
    allowedHosts: ["nativewindow.localhost"],
  });

  window.onMessage((raw, sourceUrl) => {
    void (async () => {
      if (sourceUrl !== `${loadHtmlOrigin()}/`) throw new Error("Untrusted RPC origin");

      const request: unknown = JSON.parse(raw);
      if (!request || typeof request !== "object") throw new Error("Invalid RPC request");
      const { id, method, args } = request as { id?: unknown; method?: unknown; args?: unknown };
      if (typeof method !== "string" || !Array.isArray(args)) throw new Error("Invalid RPC request");

      if (method === "report") {
        if (typeof args[0] === "string") console.error(`FEASIBILITY_OK: ${args[0]}`);
        return;
      }
      if (method !== "ping" || typeof id !== "string" || args[0] !== "crumb") {
        throw new Error("RPC validation failed");
      }

      await Bun.sleep(25);
      window.postMessage(JSON.stringify({
        id,
        result: { message: "Embedded UI and asynchronous RPC are working" },
      }));
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown RPC error";
      console.error(`FEASIBILITY_RPC_ERROR: ${message}`);
    });
  });

  window.onClose(() => process.exit(0));
  window.loadHtml(html);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown native WebView error";
  console.error(`Crumb could not initialize its native WebView: ${message}`);
  process.exitCode = 1;
}
