import { expectNoKeys, expectOnlyKeys, normalizeAbsolutePath, ValidationError } from "../../kit/shared/validation";

/**
 * One validator per declared operation. Each turns untrusted input from the
 * page into a checked value, or throws. The kit calls these; it does not know
 * what they check.
 */
export const validators = {
  getPlatformInfo: (raw: unknown): Record<string, never> => expectNoKeys(raw),

  getLocations: (raw: unknown): Record<string, never> => expectNoKeys(raw),

  listDirectory: (raw: unknown): { path: string; showHidden: boolean } => {
    const object = expectOnlyKeys(raw, ["path", "showHidden"]);
    const path = normalizeAbsolutePath(object.path);
    if (typeof object.showHidden !== "boolean") throw new ValidationError("showHidden must be boolean");
    return { path, showHidden: object.showHidden };
  },

  getPreview: (raw: unknown): { path: string } => {
    const object = expectOnlyKeys(raw, ["path"]);
    return { path: normalizeAbsolutePath(object.path) };
  },
};
