import { expectNoKeys, expectOnlyKeys, ValidationError } from "../../../../src/kit/shared/validation";

export const validators = {
  systemSnapshot: (raw: unknown): Record<string, never> => expectNoKeys(raw),
  processList: (raw: unknown): Record<string, never> => expectNoKeys(raw),
  processDetails: (raw: unknown): { identifier: number } => {
    const object = expectOnlyKeys(raw, ["identifier"]);
    if (!Number.isSafeInteger(object.identifier) || Number(object.identifier) < 0 || Number(object.identifier) > 0xffff_ffff) {
      throw new ValidationError("identifier must be an unsigned 32-bit integer");
    }
    return { identifier: Number(object.identifier) };
  },
};
