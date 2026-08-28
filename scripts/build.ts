import { createRequire } from "node:module";
import type { BunPlugin } from "bun";
import { buildNativeAddon } from "./build-native";
import { buildNativeExtensions, formatBuildMeasurement, inspectNativeExtensionArtifact, type NativeTarget } from "./build-extensions";
import { buildUiHtml } from "./ui-artifact";
import { registry } from "../app.config";
import { InvalidOutputNameError, MissingApplicationNameError, outputPath, resolveApplication, selectedApplicationName, selectedOutputName, UnknownApplicationError } from "../src/kit/shared/config";

type TargetName = NativeTarget;
const requested = (Bun.argv.find((argument) => argument.startsWith("--target="))?.split("=")[1]
  ?? (process.platform === "darwin" ? "macos-arm64" : "linux-x64")) as TargetName;
let application;
let outputName: string;
let selectedName: string;
try {
  const selected = selectedApplicationName(Bun.argv);
  application = resolveApplication(registry, selected);
  // The artifact is named after the selected application unless overridden.
  selectedName = selected ?? registry.default;
  outputName = selectedOutputName(Bun.argv) ?? selectedName;
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
if (!target) {
  console.error(`Unknown build target: ${requested}. Available targets: ${Object.keys(targets).join(", ")}.`);
  process.exit(1);
}
// Release builds run on their own operating system until native cross-compilation is proven:
// the other platform's addon is an optional dependency this machine never installed.
const buildHost = requested === "macos-arm64" ? "darwin" : "linux";
if (process.platform !== buildHost) {
  const hostName = requested === "macos-arm64" ? "macOS arm64" : "Linux x64";
  const localTarget = process.platform === "darwin" ? "macos-arm64" : "linux-x64";
  console.error(`${requested} releases must be built on their corresponding operating system until native cross-compilation is proven. Build this target on ${hostName}, or run \`bun run build --target=${localTarget}\` here.`);
  process.exit(1);
}

// Validate all extension declarations and build their artifacts before any UI,
// WebView, or executable build starts.
const extensions = await buildNativeExtensions(selectedName, application, requested);
for (const extension of extensions) console.log(formatBuildMeasurement(extension));
for (const extension of extensions) {
  const inspection = await inspectNativeExtensionArtifact(extension);
  console.log(inspection.nonSystemDependencies.length === 0
    ? `${extension.declaration.name}: no non-system dynamic dependencies`
    : `${extension.declaration.name}: non-system dynamic dependencies: ${inspection.nonSystemDependencies.join(", ")}`);
}
const extensionByName = new Map(extensions.map((extension) => [extension.declaration.name, extension.artifactPath]));

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
    build.onResolve({ filter: /^app:selection$/ }, () => ({ path: "app:selection", namespace: "app-selection" }));
    build.onLoad({ filter: /.*/, namespace: "app-selection" }, () => ({ contents: `export default ${JSON.stringify(selectedName)}`, loader: "js" }));
    build.onLoad({ filter: /.*/, namespace: "app" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
    build.onResolve({ filter: /^app:native$/ }, () => ({ path: "native-window-wrapper", namespace: "app-native" }));
    build.onLoad({ filter: /.*/, namespace: "app-native" }, () => ({
      contents: `const binding = require(${JSON.stringify(addonPath)}); export default function getNativeBinding() { return { NativeWindow: binding.NativeWindow, loadHtmlOrigin: binding.loadHtmlOrigin }; }`,
      loader: "js",
    }));
    build.onResolve({ filter: /^app:extensions$/ }, () => ({ path: "all", namespace: "app-extensions" }));
    build.onLoad({ filter: /.*/, namespace: "app-extensions" }, () => ({
      // Literal requires make every declaration visible to Bun's standalone
      // dependency scanner, even if application code reaches it only later.
      contents: extensions.map((extension) => `require(${JSON.stringify(extension.artifactPath)});`).join("\n"),
      loader: "js",
    }));
    build.onResolve({ filter: /^app:ext\/[a-z][a-z0-9_-]*$/ }, ({ path }) => ({ path: path.slice("app:ext/".length), namespace: "app-extension" }));
    build.onLoad({ filter: /.*/, namespace: "app-extension" }, ({ path }) => {
      const artifact = extensionByName.get(path);
      // The root registry imports every application config, so Bun can discover
      // an extension import belonging to an unselected application. Keep that
      // branch loadable without referencing or embedding its artifact.
      if (!artifact) return {
        contents: `export default new Proxy({}, { get() { throw new Error(${JSON.stringify(`Application "${selectedName}" does not declare native extension "${path}"`)}); } });`,
        loader: "js",
      };
      return { contents: `const extension = require(${JSON.stringify(artifact)}); export default extension;`, loader: "js" };
    });
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
