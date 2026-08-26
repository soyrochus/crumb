import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { RPC_METHODS } from "../src/host/rpc";

describe("production capability boundary", () => {
  test("exposes exactly four RPC methods", () => {
    expect([...RPC_METHODS]).toEqual(["getPlatformInfo", "getLocations", "listDirectory", "getPreview"]);
  });

  test("contains no mutation, shell, or generic whole-file read calls", async () => {
    const forbidden = /(?<!\.)\b(?:writeFile|appendFile|truncate|unlink|rm|rmdir|mkdir|rename|copyFile|chmod|chown|symlink|link|spawn|exec|execFile|readFile)\s*\(|\bBun\.(?:write|spawn)\s*\(/;
    const violations: string[] = [];
    for await (const path of new Glob("src/{host,shared}/**/*.ts").scan(".")) {
      if (forbidden.test(await Bun.file(path).text())) violations.push(path);
    }
    expect(violations).toEqual([]);
  });
});
