import { createRequire } from "node:module";
import { plugin, type BunPlugin } from "bun";
import { buildNativeAddon } from "./build-native";
import { buildUiHtml } from "./ui-artifact";

const html = await buildUiHtml();
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
await import("../main");
