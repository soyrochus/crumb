import { describe, expect, test } from "bun:test";
import { registry } from "../../../app.config";
import { crumbbrot } from "../app.config";

describe("Crumbbrot application configuration", () => {
  test("is a registered first-class application with a source-only native declaration", () => {
    expect(registry.applications.crumbbrot).toBe(crumbbrot);
    expect(crumbbrot.nativeExtensions).toEqual({
      "fractal-renderer": "examples/crumbbrot/native/fractal-renderer",
    });
    expect(Object.keys(crumbbrot.operations)).toEqual(["renderFractal"]);
  });

  test("keeps development and embedded CSP forms paired", async () => {
    const source = await Bun.file("examples/crumbbrot/src/ui/index.html").text();
    expect(source).toContain("script-src 'self'; style-src 'self'");
    expect(crumbbrot.csp).toContain("script-src 'unsafe-inline'; style-src 'unsafe-inline'");
    for (const restriction of ["connect-src 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'", "base-uri 'none'"]) {
      expect(source).toContain(restriction);
      expect(crumbbrot.csp).toContain(restriction);
    }
  });
});
