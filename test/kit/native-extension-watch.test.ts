import { describe, expect, test } from "bun:test";
import { registry } from "../../app.config";
import { applicationWatchRoots } from "../../scripts/watch-roots";

describe("native extension development watching", () => {
  test("watches declared crate source for the probe application", () => {
    expect(applicationWatchRoots(registry.applications["native-probe"]!)).toContain("src/app/native/probe");
  });

  test("does not add native roots to TypeScript-only applications", () => {
    expect(applicationWatchRoots(registry.applications.starter!)).not.toContain("src/app/native/probe");
    expect(applicationWatchRoots(registry.applications["file-explorer"]!)).not.toContain("src/app/native/probe");
  });
});
