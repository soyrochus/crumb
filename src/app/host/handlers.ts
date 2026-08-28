import { getPlatformInfo } from "../../kit/host/platform";
import { getLocations, listDirectory } from "./filesystem";
import { getPreview } from "./preview";

/** The four operations the file-explorer example implements. All are read-only. */
export const handlers = {
  getPlatformInfo: () => getPlatformInfo(),
  getLocations: () => getLocations(getPlatformInfo().platform),
  listDirectory: ({ path, showHidden }: { path: string; showHidden: boolean }) => listDirectory(path, showHidden),
  getPreview: ({ path }: { path: string }) => getPreview(path),
};
