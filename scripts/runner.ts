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
import { buildNativeExtensions, formatBuildMeasurement, type BuiltNativeExtension, type NativeTarget } from "./build-extensions";
import { buildUiHtml } from "./ui-artifact";
import { resolveApplication } from "../src/kit/shared/config";

let selectedName = process.env.CRUMB_APPLICATION ?? "";
let extensions: BuiltNativeExtension[] = [];
const extensionByName = new Map<string, string>();
(globalThis as Record<symbol, unknown>)[Symbol.for("app.nativeExtensions")] = extensionByName;
let html = "";
let resolvedAddon = "";

const runtimePlugin: BunPlugin = {
  name: "app-development-runtime",
  setup(build) {
    build.onResolve({ filter: /^app:(ui|native)$/ }, ({ path }) => ({ path: path.slice("app:".length), namespace: "app" }));
    build.onLoad({ filter: /^ui$/, namespace: "app" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
    build.onLoad({ filter: /^native$/, namespace: "app" }, () => ({
      contents: `const binding = require(${JSON.stringify(resolvedAddon)}); export default function getNativeBinding() { return { NativeWindow: binding.NativeWindow, loadHtmlOrigin: binding.loadHtmlOrigin }; }`,
      loader: "js",
    }));
    build.onResolve({ filter: /^app:extensions$/ }, () => ({ path: "all", namespace: "app-extensions" }));
    build.onLoad({ filter: /.*/, namespace: "app-extensions" }, () => ({
      contents: extensions.map((extension) => `require(${JSON.stringify(extension.artifactPath)});`).join("\n"),
      loader: "js",
    }));
  },
};
plugin(runtimePlugin);

// Register first: loading the registry also loads application modules, and
// those modules are allowed to contain app:ext/<name> imports.
const { registry } = await import("../app.config");
selectedName ||= registry.default;
const application = resolveApplication(registry, selectedName);
const extensionTarget = (process.platform === "darwin" ? "macos-arm64" : "linux-x64") as NativeTarget;
extensions = await buildNativeExtensions(selectedName, application, extensionTarget);
for (const extension of extensions) {
  extensionByName.set(extension.declaration.name, extension.artifactPath);
  console.log(formatBuildMeasurement(extension));
}
html = await buildUiHtml(application);
const addonPath = process.platform === "linux" && process.arch === "x64"
  ? await buildNativeAddon()
  : null;
const require = createRequire(import.meta.url);
resolvedAddon = addonPath ?? require.resolve("@nativewindow/webview");

const { startRuntime } = await import("./start-runtime");
startRuntime(application, { devtools: process.env.CRUMB_DEVTOOLS === "1" });
