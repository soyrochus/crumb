import type { PlatformInfo } from "../../kit/host/platform";

export type { PlatformInfo };

/**
 * The operations this application declares. Add an entry here, a validator,
 * and a handler, and the page can call it — nothing else is reachable.
 */
export type AppOperations = {
  describeHost: { input: Record<string, never>; output: HostSummary };
};

export interface HostSummary {
  platform: PlatformInfo["platform"];
  bunVersion: string;
  startedAt: string;
}
