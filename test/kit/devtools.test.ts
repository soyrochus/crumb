import { describe, expect, test } from "bun:test";
import { devtoolsEnabled } from "../../src/kit/shared/config";
import { registry } from "../../app.config";

describe("development-only diagnostics", () => {
  test("defaults to disabled", () => {
    expect(devtoolsEnabled()).toBe(false);
    expect(devtoolsEnabled({})).toBe(false);
  });

  test("enabled only by an explicit true from the launch path", () => {
    expect(devtoolsEnabled({ devtools: true })).toBe(true);
    expect(devtoolsEnabled({ devtools: false })).toBe(false);
  });

  test("no application configuration can enable developer tools", () => {
    for (const [name, application] of Object.entries(registry.applications)) {
      expect(Object.keys(application), `${name} declares a devtools field`).not.toContain("devtools");
    }
  });

  test("the release entry point requests no diagnostics", async () => {
    const entry = await Bun.file("main.ts").text();
    expect(entry).toContain("startApplication(");
    expect(entry).not.toContain("devtools");
    expect(entry).not.toContain("CRUMB_DEVTOOLS");
  });

  test("only the development runner sets the diagnostics flag", async () => {
    expect(await Bun.file("scripts/build.ts").text()).not.toContain("CRUMB_DEVTOOLS");
    expect(await Bun.file("scripts/runner.ts").text()).toContain("CRUMB_DEVTOOLS");
  });
});
