import { describe, expect, test } from "bun:test";
import { validators } from "../src/shared/validators";

describe("activity monitor operation validation", () => {
  test("no-argument operations accept only an empty object", () => {
    expect(validators.systemSnapshot({})).toEqual({});
    expect(validators.processList({})).toEqual({});
    for (const invalid of [null, undefined, [], { extra: true }, ""]) {
      expect(() => validators.systemSnapshot(invalid)).toThrow();
      expect(() => validators.processList(invalid)).toThrow();
    }
  });

  test("process details accepts an unsigned 32-bit identifier only", () => {
    expect(validators.processDetails({ identifier: 42 })).toEqual({ identifier: 42 });
    for (const identifier of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER, "42", null]) {
      expect(() => validators.processDetails({ identifier })).toThrow();
    }
    expect(() => validators.processDetails({ identifier: 42, extra: true })).toThrow();
  });
});
