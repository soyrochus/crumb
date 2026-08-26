import { createRequire } from "node:module";
import type { BunPlugin } from "bun";
import { buildUiHtml } from "./ui-artifact";

type TargetName = "linux-x64" | "macos-arm64";
const requested = (Bun.argv.find((argument) => argument.startsWith("--target="))?.split("=")[1]
  ?? (process.platform === "darwin" ? "macos-arm64" : "linux-x64")) as TargetName;
const targets = {
  "linux-x64": { bun: "bun-linux-x64" as const, addon: "@nativewindow/webview-linux-x64-gnu/native-window.linux-x64-gnu.node", output: "dist/crumb-linux-x64" },
  "macos-arm64": { bun: "bun-darwin-arm64" as const, addon: "@nativewindow/webview-darwin-arm64/native-window.darwin-arm64.node", output: "dist/crumb-macos-arm64" },
};
const target = targets[requested];
if (!target) throw new Error(`Unknown build target: ${requested}`);
if ((requested === "linux-x64" && process.platform !== "linux") || (requested === "macos-arm64" && process.platform !== "darwin")) {
  throw new Error(`${requested} releases must be built on their corresponding operating system until native cross-compilation is proven.`);
}

const html = await buildUiHtml();
const require = createRequire(import.meta.url);
let addonPath: string;
try { addonPath = require.resolve(target.addon); }
catch { throw new Error(`The target native addon is unavailable: ${target.addon}`); }

const embedPlugin: BunPlugin = {
  name: "embed-crumb-runtime",
  setup(build) {
    build.onResolve({ filter: /^crumb:ui$/ }, () => ({ path: "crumb:ui", namespace: "crumb" }));
    build.onLoad({ filter: /.*/, namespace: "crumb" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
    build.onResolve({ filter: /^@nativewindow\/webview$/ }, () => ({ path: "native-window-wrapper", namespace: "crumb-native" }));
    build.onLoad({ filter: /.*/, namespace: "crumb-native" }, () => ({
      contents: `const binding = require(${JSON.stringify(addonPath)}); export const NativeWindow = binding.NativeWindow; export const loadHtmlOrigin = binding.loadHtmlOrigin;`,
      loader: "js",
    }));
  },
};

const result = await Bun.build({
  entrypoints: ["src/host/main.ts"],
  compile: { target: target.bun, outfile: target.output, autoloadDotenv: false, autoloadBunfig: false },
  minify: true,
  plugins: [embedPlugin],
});
if (!result.success) throw new AggregateError(result.logs, "Host build failed");
console.log(`Built ${target.output}`);
