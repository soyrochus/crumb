import { describe, expect, test } from "bun:test";
import { encodePixelBuffer } from "../src/host/pixels";

describe("native pixel normalization", () => {
  test("keeps the native result binary until compact transport encoding", () => {
    expect(encodePixelBuffer(Uint8Array.from([0, 127, 255, 64]), 4)).toBe("AH//QA==");
  });

  test("rejects non-binary and wrongly sized native results", () => {
    expect(() => encodePixelBuffer([0, 1, 2, 3], 4)).toThrow("invalid pixel buffer");
    expect(() => encodePixelBuffer(Uint8Array.from([0, 1]), 4)).toThrow("expected 4 bytes");
  });
});
