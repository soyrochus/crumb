import type { ApplicationConfig } from "../src/kit/shared/config";

/** Source roots watched for one selected application; generated paths excluded. */
export function applicationWatchRoots(application: ApplicationConfig): string[] {
  const uiRoot = application.entries.uiScript.split("/").slice(0, -2).join("/");
  return [
    "src/kit",
    uiRoot,
    "app.config.ts",
    ...Object.values(application.nativeExtensions ?? {}),
  ].filter((path, index, all) => path.length > 0 && all.indexOf(path) === index);
}
