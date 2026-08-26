import { describe, expect, test } from "bun:test";
import { normalizeError, validateRpcInput } from "../src/shared/validation";

describe("RPC validation", () => {
  for (const invalid of [null, undefined, "", "relative", "a\0b", [], {}, 1]) {
    test(`rejects invalid path ${String(invalid)}`, () => {
      expect(() => validateRpcInput("getPreview", { path: invalid })).toThrow();
    });
  }

  test("normalizes absolute paths", () => {
    expect(validateRpcInput("listDirectory", { path: "/tmp/../tmp", showHidden: false }))
      .toEqual({ path: "/tmp", showHidden: false });
  });

  test("rejects malformed objects and extra arguments", () => {
    expect(() => validateRpcInput("getLocations", null)).toThrow();
    expect(() => validateRpcInput("getPlatformInfo", { extra: true })).toThrow();
    expect(() => validateRpcInput("listDirectory", { path: "/", showHidden: "yes" })).toThrow();
    expect(() => validateRpcInput("getPreview", { path: "/", extra: true })).toThrow();
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
