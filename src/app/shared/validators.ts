import { expectNoKeys } from "../../kit/shared/validation";

/** One validator per declared operation. The kit runs these before any handler. */
export const validators = {
  describeHost: (raw: unknown): Record<string, never> => expectNoKeys(raw),
};
