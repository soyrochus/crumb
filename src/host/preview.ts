import { opendir } from "node:fs/promises";
import type { ImagePreview, Preview } from "../shared/contracts";
import { inspectEntry } from "./filesystem";

export const TEXT_LIMIT = 1024 * 1024;
export const TEXT_SAMPLE_LIMIT = 8 * 1024;
export const IMAGE_LIMIT = 25 * 1024 * 1024;
export const DIRECTORY_COUNT_LIMIT = 50_000;

const textExtensions = new Set([
  "txt", "md", "markdown", "json", "jsonl", "csv", "tsv", "xml", "html", "htm", "css",
  "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "rs", "go", "java", "c", "h", "cpp",
  "hpp", "sh", "fish", "zsh", "yaml", "yml", "toml", "ini", "conf", "log", "sql",
]);

const imageByExtension: Record<string, ImagePreview["mime"]> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
};

async function bytes(path: string, end: number): Promise<Uint8Array> {
  return new Uint8Array(await Bun.file(path).slice(0, end).arrayBuffer());
}

export function isTextSample(sample: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
  } catch {
    return false;
  }
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) controls++;
  }
  return sample.length === 0 || controls / sample.length <= 0.01;
}

function detectedImageMime(sample: Uint8Array): ImagePreview["mime"] | null {
  if (sample.length >= 8 && sample.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) return "image/png";
  if (sample[0] === 0xff && sample[1] === 0xd8 && sample[2] === 0xff) return "image/jpeg";
  const ascii = new TextDecoder().decode(sample.slice(0, 12));
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

async function directoryCount(path: string): Promise<{ count: number | null; truncated: boolean }> {
  try {
    let count = 0;
    const directory = await opendir(path);
    for await (const _child of directory) {
      if (count === DIRECTORY_COUNT_LIMIT) return { count, truncated: true };
      count++;
    }
    return { count, truncated: false };
  } catch {
    return { count: null, truncated: false };
  }
}

export async function getPreview(path: string): Promise<Preview> {
  const details = await inspectEntry(path);
  const directoryLike = details.kind === "directory" || (details.kind === "symlink" && details.targetKind === "directory");
  if (directoryLike) {
    const children = await directoryCount(path);
    return { type: "directory", details, childCount: children.count, childCountTruncated: children.truncated };
  }
  if (details.kind !== "file") return { type: "generic", details, reason: details.broken ? "unavailable" : "unsupported" };

  const extension = details.extension ?? "";
  if (extension === "svg") return { type: "generic", details, reason: "unsupported" };
  const expectedMime = imageByExtension[extension];
  if (expectedMime) {
    if ((details.size ?? 0) > IMAGE_LIMIT) return { type: "image", details, mime: expectedMime, dataUrl: null, tooLarge: true };
    const content = await bytes(path, IMAGE_LIMIT);
    const actualMime = detectedImageMime(content.slice(0, 16));
    if (actualMime !== expectedMime) return { type: "generic", details, reason: "binary" };
    return { type: "image", details, mime: actualMime, dataUrl: `data:${actualMime};base64,${content.toBase64()}`, tooLarge: false };
  }

  const knownText = textExtensions.has(extension);
  if (!knownText && !isTextSample(await bytes(path, TEXT_SAMPLE_LIMIT))) {
    return { type: "generic", details, reason: "binary" };
  }
  const content = await bytes(path, TEXT_LIMIT);
  return {
    type: "text",
    details,
    content: new TextDecoder("utf-8").decode(content),
    bytesRead: content.byteLength,
    totalBytes: details.size ?? content.byteLength,
    truncated: (details.size ?? content.byteLength) > content.byteLength,
  };
}
