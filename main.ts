import { startApplication } from "./src/kit/host/main";
import { resolveApplication } from "./src/kit/shared/config";
import { registry } from "./app.config";

startApplication(resolveApplication(registry, process.env.CRUMB_APPLICATION || undefined));
