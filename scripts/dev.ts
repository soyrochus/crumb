/**
 * Development supervisor. Resolves the selected application, then runs it in a
 * child process so a source change can restart the window without ending this
 * command.
 *
 * Pass `--example=<name>` to select an application and `--no-watch` to run once.
 */
import { watch } from "node:fs";
import { registry } from "../app.config";
import { resolveApplication, UnknownApplicationError, type ApplicationConfig, MissingApplicationNameError, selectedApplicationName } from "../src/kit/shared/config";

function selectApplication(): { name: string; application: ApplicationConfig } {
  try {
    const selected = selectedApplicationName(Bun.argv);
    return { name: selected ?? registry.default, application: resolveApplication(registry, selected) };
  } catch (error: unknown) {
    if (error instanceof UnknownApplicationError || error instanceof MissingApplicationNameError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const { name, application } = selectApplication();
const watching = !Bun.argv.includes("--no-watch");

let child: Bun.Subprocess | null = null;
let restarting = false;

function start(): void {
  child = Bun.spawn(["bun", "run", "scripts/runner.ts"], {
    env: { ...process.env, CRUMB_APPLICATION: name, CRUMB_DEVTOOLS: "1" },
    stdout: "inherit",
    stderr: "inherit",
    onExit(_subprocess, exitCode) {
      // A non-zero exit while watching is a build or startup error: report it
      // and keep the watcher alive so the next save can recover.
      if (!restarting && exitCode && !watching) process.exitCode = exitCode;
      if (!restarting && exitCode && watching) console.error(`Application exited with code ${exitCode}; waiting for changes.`);
    },
  });
}

function stop(): void {
  child?.kill();
  child = null;
}

/** Source roots to watch. Never `dist/`, `.build/`, or `node_modules/`. */
function watchRoots(): string[] {
  const uiRoot = application.entries.uiScript.split("/").slice(0, -2).join("/");
  return ["src/kit", uiRoot, "app.config.ts"].filter((path) => path.length > 0);
}

process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

console.log(`Running ${application.name} (${name})${watching ? " — watching for changes" : ""}`);
start();

if (watching) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onChange = (file: string | null) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`Changed: ${file ?? "source"} — rebuilding`);
      restarting = true;
      stop();
      start();
      restarting = false;
    }, 120);
  };
  for (const root of watchRoots()) {
    try {
      watch(root, { recursive: true }, (_event, file) => onChange(file ? `${root}/${file}` : null));
    } catch {
      // A missing or unwatchable root is not fatal; the rest keep working.
    }
  }
  await new Promise(() => undefined);
} else {
  await child!.exited;
}
