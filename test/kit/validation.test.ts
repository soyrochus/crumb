import { describe, expect, test } from "bun:test";
import { expectNoKeys, expectOnlyKeys, normalizeAbsolutePath, normalizeError } from "../../src/kit/shared/validation";

describe("generic input validation", () => {
  for (const invalid of [null, undefined, "", "relative", "a\0b", [], {}, 1]) {
    test(`rejects invalid path ${String(invalid)}`, () => {
      expect(() => normalizeAbsolutePath(invalid)).toThrow();
    });
  }

  test("normalizes absolute paths", () => {
    expect(normalizeAbsolutePath("/tmp/../tmp")).toBe("/tmp");
  });

  test("rejects malformed objects and extra arguments", () => {
    expect(() => expectNoKeys(null)).toThrow();
    expect(() => expectNoKeys({ extra: true })).toThrow();
    expect(() => expectOnlyKeys({ path: "/", extra: true }, ["path"])).toThrow();
  });
});

describe("filesystem error normalization", () => {
  test.each([
    ["ENOENT", "NOT_FOUND"],
    ["EACCES", "PERMISSION_DENIED"],
    ["EPERM", "PERMISSION_DENIED"],
    ["ENOTDIR", "NOT_DIRECTORY"],
    ["ESTALE", "UNAVAILABLE"],
    ["UNKNOWN", "UNAVAILABLE"],
  ] as const)("maps %s", (source, expected) => {
    expect(normalizeError({ code: source, stack: "secret" }).code).toBe(expected);
    expect(normalizeError({ code: source, stack: "secret" })).not.toHaveProperty("stack");
  });
});
