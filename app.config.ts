import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";
import { fileExplorer } from "./examples/file-explorer/app.config";
import { nativeProbe } from "./examples/native-probe/app.config";
import { activityMonitor } from "./examples/activity-monitor/app.config";
import { crumbbrot } from "./examples/crumbbrot/app.config";

/**
 * The applications this repository can build.
 *
 * `starter` is the minimal application in `src/app/` — what a fresh clone runs
 * and what you edit to build your own. The registered applications under
 * `examples/` are separate worked examples. Select one with `--example=<name>`.
 */
export const registry: ApplicationRegistry = {
  default: "starter",
  applications: {
    starter,
    "file-explorer": fileExplorer,
    "native-probe": nativeProbe,
    "activity-monitor": activityMonitor,
    crumbbrot,
  },
};
