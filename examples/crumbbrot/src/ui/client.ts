import { invoke } from "../../../../src/kit/ui/bridge";
import type { CrumbbrotOperations, RenderFractalInput, RenderFractalOutput } from "../shared/contracts";

export const rpc = {
  render(input: RenderFractalInput): Promise<RenderFractalOutput> {
    return invoke<CrumbbrotOperations, "renderFractal">("renderFractal", input);
  },
};
