import { getPlatformInfo } from "../../kit/host/platform";
import type { HostSummary } from "../shared/contracts";

/** Runs in the trusted Bun host. This is where your application does real work. */
export const handlers = {
  describeHost: (): HostSummary => ({
    platform: getPlatformInfo().platform,
    bunVersion: Bun.version,
    startedAt: new Date().toISOString(),
  }),
};

