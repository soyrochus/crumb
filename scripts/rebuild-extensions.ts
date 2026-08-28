import { registry } from "../app.config";
import { resolveApplication, selectedApplicationName } from "../src/kit/shared/config";
import { buildNativeExtensions, cleanNativeExtensions, formatBuildMeasurement, type NativeTarget } from "./build-extensions";

const selected = selectedApplicationName(Bun.argv);
const name = selected ?? registry.default;
const application = resolveApplication(registry, selected);
const target = (Bun.argv.find((argument) => argument.startsWith("--target="))?.slice("--target=".length)
  ?? (process.platform === "darwin" ? "macos-arm64" : "linux-x64")) as NativeTarget;

await cleanNativeExtensions(name, application, target);
const results = await buildNativeExtensions(name, application, target, { force: true });
if (results.length === 0) console.log(`Application "${name}" declares no native extensions; nothing to rebuild.`);
for (const result of results) console.log(formatBuildMeasurement(result));
