import { describe, expect, test } from "bun:test";
import { validators } from "../src/shared/validators";

describe("declared operation validation", () => {
  for (const invalid of [null, undefined, "", "relative", "a\0b", [], {}, 1]) {
    test(`rejects invalid path ${String(invalid)}`, () => {
      expect(() => validators.getPreview({ path: invalid })).toThrow();
    });
  }

  test("normalizes absolute paths", () => {
    expect(validators.listDirectory({ path: "/tmp/../tmp", showHidden: false }))
      .toEqual({ path: "/tmp", showHidden: false });
  });

  test("rejects malformed objects and extra arguments", () => {
    expect(() => validators.getLocations(null)).toThrow();
    expect(() => validators.getPlatformInfo({ extra: true })).toThrow();
    expect(() => validators.listDirectory({ path: "/", showHidden: "yes" })).toThrow();
    expect(() => validators.getPreview({ path: "/", extra: true })).toThrow();
  });
});
