import { describe, expect, test } from "bun:test";
import { detectPlatform, getPlatformInfo, StartupConfigurationError, startupErrorMessage } from "../src/host/platform";

describe("platform support", () => {
  test("reports macOS modifier", () => {
    expect(getPlatformInfo("darwin")).toEqual({ platform: "macos", primaryModifier: "Meta" });
  });

  test("reports Linux modifier", () => {
    expect(getPlatformInfo("linux")).toEqual({ platform: "linux", primaryModifier: "Control" });
  });

  test("rejects unsupported platforms cleanly", () => {
    expect(() => detectPlatform("win32")).toThrow("unsupported");
    expect(startupErrorMessage(new Error("private stack details"))).not.toContain("private");
    expect(startupErrorMessage(new StartupConfigurationError("Wayland is required"))).toBe("Wayland is required");
  });
});
