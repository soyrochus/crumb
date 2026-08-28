import SELECTED_APPLICATION from "app:selection";
import "app:extensions";
import { startApplication } from "./src/kit/host/main";
import { resolveApplication } from "./src/kit/shared/config";
import { registry } from "./app.config";

// The application is chosen when the executable is built, not when it runs:
// the build embeds one application's user interface, so resolving a different
// one here would wire that page to the wrong operations.
startApplication(resolveApplication(registry, SELECTED_APPLICATION));
