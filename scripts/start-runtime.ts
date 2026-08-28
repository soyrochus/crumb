import { startApplication, type StartOptions } from "../src/kit/host/main";
import type { ApplicationConfig } from "../src/kit/shared/config";

/** Imported only after the development runtime plugin has been registered. */
export function startRuntime(application: ApplicationConfig, options: StartOptions): void {
  startApplication(application, options);
}
