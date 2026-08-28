import { createRequire } from "node:module";
import type { BunPlugin } from "bun";
import { buildNativeAddon } from "./build-native";
import { buildUiHtml } from "./ui-artifact";
import { registry } from "../app.config";
import { InvalidOutputNameError, MissingApplicationNameError, outputPath, resolveApplication, selectedApplicationName, selectedOutputName, UnknownApplicationError } from "../src/kit/shared/config";

type TargetName = "linux-x64" | "macos-arm64";
const requested = (Bun.argv.find((argument) => argument.startsWith("--target="))?.split("=")[1]
  ?? (process.platform === "darwin" ? "macos-arm64" : "linux-x64")) as TargetName;
let application;
let outputName: string;
try {
  const selected = selectedApplicationName(Bun.argv);
  application = resolveApplication(registry, selected);
  // The artifact is named after the selected application unless overridden.
  outputName = selectedOutputName(Bun.argv) ?? selected ?? registry.default;
  outputPath(outputName, "check");
} catch (error: unknown) {
  if (error instanceof UnknownApplicationError || error instanceof MissingApplicationNameError || error instanceof InvalidOutputNameError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
const targets = {
  "linux-x64": { bun: "bun-linux-x64" as const, addon: null, output: outputPath(outputName, "linux-x64") },
  "macos-arm64": { bun: "bun-darwin-arm64" as const, addon: "@nativewindow/webview-darwin-arm64/native-window.darwin-arm64.node", output: outputPath(outputName, "macos-arm64") },
};
const target = targets[requested];
if (!target) throw new Error(`Unknown build target: ${requested}`);
if ((requested === "linux-x64" && process.platform !== "linux") || (requested === "macos-arm64" && process.platform !== "darwin")) {
  throw new Error(`${requested} releases must be built on their corresponding operating system until native cross-compilation is proven.`);
}

const html = await buildUiHtml(application);
const require = createRequire(import.meta.url);
let addonPath: string;
if (requested === "linux-x64") addonPath = await buildNativeAddon();
else {
  try { addonPath = require.resolve(target.addon!); }
  catch { throw new Error(`The target native addon is unavailable: ${target.addon}`); }
}

const embedPlugin: BunPlugin = {
  name: "embed-app-runtime",
  setup(build) {
    build.onResolve({ filter: /^app:ui$/ }, () => ({ path: "app:ui", namespace: "app" }));
    build.onLoad({ filter: /.*/, namespace: "app" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
    build.onResolve({ filter: /^app:native$/ }, () => ({ path: "native-window-wrapper", namespace: "app-native" }));
    build.onLoad({ filter: /.*/, namespace: "app-native" }, () => ({
      contents: `const binding = require(${JSON.stringify(addonPath)}); export default function getNativeBinding() { return { NativeWindow: binding.NativeWindow, loadHtmlOrigin: binding.loadHtmlOrigin }; }`,
      loader: "js",
    }));
  },
};

const result = await Bun.build({
  entrypoints: ["main.ts"],
  compile: { target: target.bun, outfile: target.output, autoloadDotenv: false, autoloadBunfig: false },
  minify: true,
  plugins: [embedPlugin],
});
if (!result.success) throw new AggregateError(result.logs, "Host build failed");
console.log(`Built ${target.output}`);
