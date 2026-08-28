import { expect, test } from "bun:test";

test("the interface renders native process names as text and exposes no process action", async () => {
  const source = await Bun.file(new URL("../src/ui/app.ts", import.meta.url)).text();
  expect(source).toContain("textContent = value");
  expect(source).not.toContain("innerHTML");
  expect(source).not.toMatch(/\b(kill|suspend|renice|terminate)\s*\(/u);
});
