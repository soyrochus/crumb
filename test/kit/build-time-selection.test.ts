import { describe, expect, test } from "bun:test";
import { registry } from "../../app.config";
import { resolveApplication } from "../../src/kit/shared/config";

/**
 * Regression guard. The build embeds one application's user interface, so the
 * release entry must resolve the application chosen at *build* time. Resolving
 * a runtime default instead wires the embedded page to another application's
 * operations — the page loads, then every call it makes is rejected as
 * undeclared.
 */
describe("build-time application selection", () => {
  test("the release entry takes its selection from the build, not a runtime default", async () => {
    const entry = await Bun.file("main.ts").text();
    expect(entry).toContain('from "app:selection"');
    expect(entry).toContain("resolveApplication(registry, SELECTED_APPLICATION)");
    // A runtime default or environment lookup is exactly the regression.
    expect(entry).not.toContain("process.env");
    expect(entry).not.toContain("registry.default");
  });

  test("the build supplies the selection virtual module", async () => {
    const build = await Bun.file("scripts/build.ts").text();
    expect(build).toContain("app:selection");
    expect(build).toContain("selectedName");
  });

  test("the selection module is declared for type checking", async () => {
    expect(await Bun.file("src/kit/ui/virtual.d.ts").text()).toContain('declare module "app:selection"');
  });

  test("each application resolves to its own operations", () => {
    const explorer = resolveApplication(registry, "file-explorer");
    const starter = resolveApplication(registry, "starter");
    expect(Object.keys(explorer.operations)).toContain("listDirectory");
    expect(Object.keys(starter.operations)).not.toContain("listDirectory");
    expect(explorer.window.title).not.toBe(starter.window.title);
  });
});
