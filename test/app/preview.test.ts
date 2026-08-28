import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPreview, IMAGE_LIMIT, isTextSample, TEXT_LIMIT } from "../../src/app/host/preview";

const temporary: string[] = [];
async function fixture(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "crumb-preview-"));
  temporary.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("preview classification", () => {
  test("counts only direct directory children", async () => {
    const root = await fixture();
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "nested", "child"), "x");
    const preview = await getPreview(root);
    expect(preview.type).toBe("directory");
    if (preview.type === "directory") expect(preview.childCount).toBe(1);
  });

  test("returns bounded inert text and truncation metadata", async () => {
    const root = await fixture();
    const content = `<script>globalThis.compromised=true</script>\n${"x".repeat(TEXT_LIMIT)}`;
    const path = join(root, "hostile.html");
    await writeFile(path, content);
    const preview = await getPreview(path);
    expect(preview.type).toBe("text");
    if (preview.type === "text") {
      expect(preview.content.startsWith("<script>")).toBe(true);
      expect(preview.bytesRead).toBe(TEXT_LIMIT);
      expect(preview.truncated).toBe(true);
    }
  });

  test("detects unknown binary and malformed UTF-8", async () => {
    expect(isTextSample(new Uint8Array([0, 1, 2]))).toBe(false);
    expect(isTextSample(new Uint8Array([0xc3, 0x28]))).toBe(false);
    const root = await fixture();
    const path = join(root, "unknown.binlike");
    await writeFile(path, new Uint8Array([0, 1, 2, 3]));
    expect((await getPreview(path)).type).toBe("generic");

    const known = join(root, "malformed.txt");
    await writeFile(known, new Uint8Array([0xc3, 0x28]));
    const malformed = await getPreview(known);
    expect(malformed.type).toBe("text");
    if (malformed.type === "text") expect(malformed.content).toContain("�");
  });

  test("validates image magic before creating a data URL", async () => {
    const root = await fixture();
    const good = join(root, "pixel.png");
    await writeFile(good, Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
    const image = await getPreview(good);
    expect(image.type).toBe("image");
    if (image.type === "image") expect(image.dataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    const fake = join(root, "fake.png");
    await writeFile(fake, "not an image");
    expect((await getPreview(fake)).type).toBe("generic");

    const oversized = join(root, "oversized.png");
    await writeFile(oversized, "");
    await truncate(oversized, IMAGE_LIMIT + 1);
    const tooLarge = await getPreview(oversized);
    expect(tooLarge.type).toBe("image");
    if (tooLarge.type === "image") {
      expect(tooLarge.tooLarge).toBe(true);
      expect(tooLarge.dataUrl).toBeNull();
    }
  });

  test("never actively previews SVG", async () => {
    const root = await fixture();
    const path = join(root, "scripted.svg");
    await writeFile(path, `<svg onload="alert(1)"><script>alert(2)</script></svg>`);
    expect((await getPreview(path)).type).toBe("generic");
  });

  test("reports disappearing files", async () => {
    const root = await fixture();
    await expect(getPreview(join(root, "gone"))).rejects.toBeDefined();
  });
});
