import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { NativeWindow as NativeWindowInstance, WindowOptions } from "@nativewindow/webview";
import { listDirectory } from "../src/host/filesystem";
import { getPreview } from "../src/host/preview";
import { createRpcRouter, type RpcHandlers, type RpcRequest } from "../src/host/rpc";
import type { Preview } from "../src/shared/contracts";
import { ExplorerState } from "../src/ui/state";
import { buildNativeAddon } from "./build-native";
import { buildUiHtml } from "./ui-artifact";

const limits = {
  uiStartupMs: 5_000,
  fiveThousandRowsMs: 2_000,
  ordinaryListingMs: 5_000,
  textPreviewMs: 3_000,
  imagePreviewMs: 3_000,
  retainedRssBytes: 256 * 1024 * 1024,
};

function elapsed(started: number): number {
  return Number(((performance.now() - started)).toFixed(1));
}

function requireWithin(name: string, actual: number, maximum: number, unit: string): void {
  if (actual > maximum) throw new Error(`${name} exceeded its ${maximum}${unit} limit: ${actual}${unit}`);
}

async function time<T>(operation: () => Promise<T>): Promise<{ value: T; milliseconds: number }> {
  const started = performance.now();
  return { value: await operation(), milliseconds: elapsed(started) };
}

interface UiReport {
  startupMs: number;
  fiveThousandRowsMs: number;
  rowCount: number;
}

async function verifyNativeUi(html: string, fixtureRoot: string): Promise<UiReport> {
  if (process.platform === "linux") process.env.GDK_BACKEND = "wayland";
  const require = createRequire(import.meta.url);
  const nativeBinding = require(process.platform === "linux"
    ? await buildNativeAddon()
    : "@nativewindow/webview") as {
    NativeWindow: new (options: WindowOptions) => NativeWindowInstance;
    loadHtmlOrigin: () => string;
  };
  const { NativeWindow, loadHtmlOrigin } = nativeBinding;
  const handlers: RpcHandlers = {
    getPlatformInfo: () => ({
      platform: process.platform === "darwin" ? "macos" : "linux",
      primaryModifier: process.platform === "darwin" ? "Meta" : "Control",
    }),
    getLocations: () => [{ id: `home:${fixtureRoot}`, label: "Home", path: fixtureRoot, kind: "home" }],
    listDirectory: ({ path, showHidden }) => listDirectory(path, showHidden),
    getPreview: ({ path }) => getPreview(path),
  };
  const route = createRpcRouter(handlers);
  const benchmarkScript = String.raw`<script>
    (() => {
      const waitForInitialRender = () => {
        const entries = document.getElementById("entries");
        const status = document.getElementById("status");
        if (!entries || !status || status.textContent === "Starting…" || status.textContent === "Loading…") {
          requestAnimationFrame(waitForInitialRender);
          return;
        }
        const startupMs = performance.now();
        const started = performance.now();
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < 5000; index++) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "entry";
          row.setAttribute("role", "option");
          row.setAttribute("aria-selected", "false");
          const name = document.createElement("span");
          name.className = "name";
          name.textContent = "file-" + index + ".txt";
          row.append(name);
          fragment.append(row);
        }
        entries.replaceChildren(fragment);
        const fiveThousandRowsMs = performance.now() - started;
        window.ipc.postMessage(JSON.stringify({
          method: "performanceReport",
          performance: { startupMs, fiveThousandRowsMs, rowCount: entries.childElementCount },
        }));
      };
      requestAnimationFrame(waitForInitialRender);
    })();
  </script>`;
  const instrumentedHtml = html.replace("</body>", `${benchmarkScript}</body>`);

  return await new Promise<UiReport>((resolve, reject) => {
    const window = new NativeWindow({
      title: "Crumb performance verification",
      width: 1200,
      height: 760,
      minWidth: 800,
      minHeight: 500,
      visible: true,
      devtools: false,
      incognito: true,
      trustedOrigins: [loadHtmlOrigin()],
      allowedHosts: ["nativewindow.localhost"],
      csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
    });
    const timeout = setTimeout(() => {
      window.close();
      reject(new Error("Native UI performance check timed out"));
    }, 15_000);

    window.onMessage((raw, sourceUrl) => {
      void (async () => {
        if (sourceUrl !== `${loadHtmlOrigin()}/`) throw new Error("Untrusted performance-check origin");
        const request: unknown = JSON.parse(raw);
        if (!request || typeof request !== "object") throw new Error("Invalid performance-check message");
        const message = request as Partial<RpcRequest> & { performance?: unknown };
        if (message.method === "performanceReport") {
          const report = message.performance as Partial<UiReport> | undefined;
          if (!report || typeof report.startupMs !== "number" || typeof report.fiveThousandRowsMs !== "number" || report.rowCount !== 5_000) {
            throw new Error("Invalid native UI performance report");
          }
          clearTimeout(timeout);
          window.close();
          resolve(report as UiReport);
          return;
        }
        if (typeof message.id !== "string" || typeof message.method !== "string") throw new Error("Invalid RPC request");
        window.postMessage(JSON.stringify(await route({ id: message.id, method: message.method, input: message.input })));
      })().catch((error: unknown) => {
        clearTimeout(timeout);
        window.close();
        reject(error);
      });
    });
    window.loadHtml(instrumentedHtml);
  });
}

const fixtureRoot = await mkdtemp(join(tmpdir(), "crumb-performance-"));
try {
  await Promise.all(Array.from({ length: 250 }, (_, index) => writeFile(join(fixtureRoot, `file-${index}.txt`), `file ${index}`)));
  const textPath = join(fixtureRoot, "large-text.txt");
  const imagePath = join(fixtureRoot, "large-image.png");
  await writeFile(textPath, "x".repeat(1024 * 1024));
  const imageBytes = new Uint8Array(8 * 1024 * 1024);
  imageBytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  await writeFile(imagePath, imageBytes);

  const listing = await time(() => listDirectory(fixtureRoot, false));
  const textPreview = await time(() => getPreview(textPath));
  const imagePreview = await time(() => getPreview(imagePath));
  requireWithin("Ordinary directory listing", listing.milliseconds, limits.ordinaryListingMs, "ms");
  requireWithin("Bounded text preview", textPreview.milliseconds, limits.textPreviewMs, "ms");
  requireWithin("Bounded image preview", imagePreview.milliseconds, limits.imagePreviewMs, "ms");

  const services = {
    listDirectory: async (path: string) => ({ path, entries: [], truncated: false }),
    getPreview: async (path: string): Promise<Preview> => path === imagePath
      ? imagePreview.value
      : textPreview.value,
  };
  Bun.gc(true);
  const baselineRss = process.memoryUsage().rss;
  const state = new ExplorerState(fixtureRoot, services);
  await state.select(imagePath);
  await state.select(textPath);
  state.clearSelection();
  Bun.gc(true);
  if (state.preview !== null || state.selectedPath !== null) throw new Error("Superseded preview payload was retained");
  const retainedRss = Math.max(0, process.memoryUsage().rss - baselineRss);
  requireWithin("Retained preview memory", retainedRss, limits.retainedRssBytes, " bytes");

  const builtUi = await time(() => buildUiHtml());
  const ui = await verifyNativeUi(builtUi.value, fixtureRoot);
  requireWithin("Native UI startup", ui.startupMs, limits.uiStartupMs, "ms");
  requireWithin("5,000-row DOM commit", ui.fiveThousandRowsMs, limits.fiveThousandRowsMs, "ms");

  console.log("Performance verification passed");
  console.log(JSON.stringify({
    uiBundleMs: builtUi.milliseconds,
    uiStartupMs: Number(ui.startupMs.toFixed(1)),
    fiveThousandRowsMs: Number(ui.fiveThousandRowsMs.toFixed(1)),
    ordinaryListingMs: listing.milliseconds,
    textPreviewMs: textPreview.milliseconds,
    imagePreviewMs: imagePreview.milliseconds,
    retainedRssMiB: Number((retainedRss / 1024 / 1024).toFixed(1)),
  }, null, 2));
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
