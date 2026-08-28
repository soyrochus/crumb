import { invoke } from "../../../../src/kit/ui/bridge";
import type { ActivityMonitorOperations, ProcessDetails, ProcessSummary, SystemSnapshot } from "../shared/contracts";

function call<K extends keyof ActivityMonitorOperations & string>(
  method: K,
  input: ActivityMonitorOperations[K]["input"],
): Promise<ActivityMonitorOperations[K]["output"]> {
  return invoke<ActivityMonitorOperations, K>(method, input);
}

export const rpc = {
  snapshot: (): Promise<SystemSnapshot> => call("systemSnapshot", {}),
  processes: (): Promise<ProcessSummary[]> => call("processList", {}),
  details: (identifier: number): Promise<ProcessDetails | null> => call("processDetails", { identifier }),
};
