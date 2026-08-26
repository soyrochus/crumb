import { Glob } from "bun";

const forbidden = /(?<!\.)\b(?:writeFile|appendFile|truncate|unlink|rm|rmdir|mkdir|rename|copyFile|chmod|chown|symlink|link|spawn|exec|execFile|readFile)\s*\(|\bBun\.(?:write|spawn)\s*\(/;
const violations: string[] = [];
for await (const path of new Glob("src/{host,shared}/**/*.ts").scan(".")) {
  if (forbidden.test(await Bun.file(path).text())) violations.push(path);
}
if (violations.length) throw new Error(`Read-only boundary violations: ${violations.join(", ")}`);
console.log("Read-only production capability boundary verified");
