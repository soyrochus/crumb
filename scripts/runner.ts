/**
 * Development runner. Runs as its own process so the supervisor in `dev.ts`
 * can restart it on a source change without exiting the command.
 *
 * It registers the `app:ui` / `app:native` virtual modules itself — the plugin
 * must be installed in the process that imports the host, so it cannot be
 * inherited from the parent.
 */
import { createRequire } from "node:module";
import { plugin, type BunPlugin } from "bun";
import { buildNativeAddon } from "./build-native";
import { buildUiHtml } from "./ui-artifact";
import { registry } from "../app.config";
import { resolveApplication } from "../src/kit/shared/config";

const application = resolveApplication(registry, process.env.CRUMB_APPLICATION || undefined);
const html = await buildUiHtml(application);
const addonPath = process.platform === "linux" && process.arch === "x64"
  ? await buildNativeAddon()
  : null;
const require = createRequire(import.meta.url);
const resolvedAddon = addonPath ?? require.resolve("@nativewindow/webview");

const runtimePlugin: BunPlugin = {
  name: "app-development-runtime",
  setup(build) {
    build.onResolve({ filter: /^app:(ui|native)$/ }, ({ path }) => ({ path: path.slice("app:".length), namespace: "app" }));
    build.onLoad({ filter: /^ui$/, namespace: "app" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
    build.onLoad({ filter: /^native$/, namespace: "app" }, () => ({
      contents: `const binding = require(${JSON.stringify(resolvedAddon)}); export default function getNativeBinding() { return { NativeWindow: binding.NativeWindow, loadHtmlOrigin: binding.loadHtmlOrigin }; }`,
      loader: "js",
    }));
  },
};
plugin(runtimePlugin);

const { startApplication } = await import("../src/kit/host/main");
startApplication(application, { devtools: process.env.CRUMB_DEVTOOLS === "1" });
