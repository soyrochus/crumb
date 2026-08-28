import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";
import { fileExplorer } from "./examples/file-explorer/app.config";
import { nativeProbe } from "./examples/native-probe/app.config";

/**
 * The applications this repository can build.
 *
 * `starter` is the minimal application in `src/app/` — what a fresh clone runs
 * and what you edit to build your own. `file-explorer` is the worked example
 * under `examples/`. Select one with `--example=<name>`.
 */
export const registry: ApplicationRegistry = {
  default: "starter",
  applications: {
    starter,
    "file-explorer": fileExplorer,
    "native-probe": nativeProbe,
  },
};
