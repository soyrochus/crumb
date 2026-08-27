import { copyFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const UPSTREAM_COMMIT = "acfbe3ce4be2b70dc664bdd6c5feb53c52f9ce3e";
const ARCHIVE_SHA256 = "ddc10437e3cc7fcc2b18c0905f396e82d7a1cedccc88a05b3b86976cf4b77734";
const buildRoot = resolve(".build/nativewindow-webview-v1.0.6");
const archivePath = join(buildRoot, "upstream.tar.gz");
const sourceRoot = join(buildRoot, `webview-${UPSTREAM_COMMIT}`);
const crateRoot = join(sourceRoot, "packages/webview");
const outputPath = join(buildRoot, "native-window.linux-x64-gnu.node");
const patchPath = resolve("native/nativewindow-webview-v1.0.6-wayland.patch");

async function run(command: string[], cwd = process.cwd(), environment?: Record<string, string | undefined>): Promise<void> {
  const processHandle = Bun.spawn(command, {
    cwd,
    env: environment ?? process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await processHandle.exited;
  if (exitCode !== 0) throw new Error(`${command[0] ?? "Command"} failed with exit code ${exitCode}`);
}

async function verifiedArchiveExists(): Promise<boolean> {
  const archive = Bun.file(archivePath);
  if (!await archive.exists()) return false;
  const digest = new Bun.CryptoHasher("sha256").update(await archive.arrayBuffer()).digest("hex");
  return digest === ARCHIVE_SHA256;
}

export async function buildNativeAddon(): Promise<string> {
  if (process.platform !== "linux" || process.arch !== "x64") {
    const guidance = process.platform === "darwin" && process.arch === "arm64"
      ? "On macOS arm64, `bun install` provides the prebuilt WKWebView addon; use `bun run dev` or `bun run build --target=macos-arm64` instead."
      : "Run this command on Linux x64, or use the build command for a supported target.";
    throw new Error(`\`build:native\` only builds Crumb's patched Linux x64 Wayland addon and cannot run on ${process.platform} ${process.arch}. ${guidance}`);
  }
  if (await Bun.file(outputPath).exists()) return outputPath;
  await mkdir(buildRoot, { recursive: true });

  if (!await verifiedArchiveExists()) {
    await rm(archivePath, { force: true });
    const response = await fetch(`https://github.com/nativewindow/webview/archive/${UPSTREAM_COMMIT}.tar.gz`);
    if (!response.ok) throw new Error(`Could not download pinned native source: HTTP ${response.status}`);
    await Bun.write(archivePath, response);
    if (!await verifiedArchiveExists()) throw new Error("Pinned native source checksum mismatch");
  }

  await rm(sourceRoot, { recursive: true, force: true });
  await run(["tar", "-xzf", archivePath, "-C", buildRoot]);
  await run(["patch", "--fuzz=0", "-p1", "-i", patchPath], sourceRoot);
  await run(["cargo", "build", "--release", "--locked"], crateRoot, {
    ...process.env,
    CARGO_TARGET_DIR: join(buildRoot, "target"),
  });
  await copyFile(join(buildRoot, "target/release/libnative_window.so"), outputPath);
  return outputPath;
}

if (import.meta.main) console.log(await buildNativeAddon());
