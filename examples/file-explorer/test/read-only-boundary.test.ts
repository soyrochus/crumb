import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { registry } from "../../../app.config";

describe("file-explorer capability boundary", () => {
  test("declares exactly four operations", () => {
    expect(Object.keys(registry.applications["file-explorer"]!.operations).sort())
      .toEqual(["getLocations", "getPlatformInfo", "getPreview", "listDirectory"]);
  });

  test("contains no mutation, shell, or generic whole-file read calls", async () => {
    const forbidden = /(?<!\.)\b(?:writeFile|appendFile|truncate|unlink|rm|rmdir|mkdir|rename|copyFile|chmod|chown|symlink|link|spawn|exec|execFile|readFile)\s*\(|\bBun\.(?:write|spawn)\s*\(/;
    const violations: string[] = [];
    for await (const path of new Glob("examples/file-explorer/src/**/*.ts").scan(".")) {
      if (forbidden.test(await Bun.file(path).text())) violations.push(path);
    }
    expect(violations).toEqual([]);
  });
});
