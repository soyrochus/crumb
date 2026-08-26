# Native shell feasibility

Tested on 26 August 2026 with Bun 1.4.0 and `@nativewindow/webview` 1.0.6 from a Linux x64 Wayland session.

## Selected architecture

Crumb uses `@nativewindow/webview` with a small host adapter around its string IPC channel. Requests and responses are JSON messages with request identifiers and runtime validation. Host handlers may complete asynchronously because the binding pumps native events without blocking Bun's task queue.

Linux support is native Wayland only. Crumb forces `GDK_BACKEND=wayland`, does not connect to an X server, and cannot fall back to X11/XWayland. Ubuntu's stock GTK/WebKitGTK binaries retain transitive linkage to `libX11` compatibility libraries even when their Wayland backend is active; those dormant system-library links are not an application backend.

## Results

| Check | Result |
| --- | --- |
| Strict Bun/TypeScript project and pinned binding | Pass |
| Native Linux Wayland window creation | Pass with `GDK_BACKEND=wayland` |
| Validated asynchronous UI-to-host-to-UI RPC | Pass; the page reports `FEASIBILITY_OK: Embedded UI and asynchronous RPC are working` |
| Developer tools control | Pass; disabled through the window options |
| Trusted IPC origins | Pass; restricted to the binding's `loadHtml()` origin and rechecked by the host adapter |
| External navigation controls | Pass at the binding layer through allowed-host restrictions and native blocked-navigation handling |
| Linux x64 standalone compilation | Pass |
| Relocated Linux executable without adjacent application files | Pass; the forced-Wayland launch completes the async RPC probe |
| Linux native shared-library resolution | Pass on Ubuntu 26.04; the packaged addon reports no missing dependency and uses GTK 3/WebKitGTK 4.1. `ldd` also exposes the distro stack's dormant `libX11` compatibility linkage. |
| macOS arm64 compilation and relocation | Pending verification on a macOS arm64 build host |
| macOS arm64 runtime/clean-machine verification | Pending verification on macOS arm64 |

The Linux launch emits a GTK warning about adding a WebKitWebView to a GtkApplicationWindow that already contains a GtkBox. It is non-fatal in the feasibility probe, but it should be tracked during resize and lifecycle verification.

## Standalone addon embedding

The package's default JavaScript loader computes the platform package name dynamically. Bun cannot discover that dynamic require while compiling a standalone executable, so an otherwise valid binary fails after relocation because the `.node` addon is absent.

Crumb's platform adapter must directly require the target-specific addon with a literal module path. Bun then embeds the Node-API addon in the executable. This pattern was verified by copying only the Linux executable to an empty temporary directory and completing the native Wayland async RPC probe there.

Release builds remain native to their target operating system until cross-compilation of the corresponding addon is independently proven.

## Rejected bindings

- `webview-bun` 2.4.0 opens a native Linux window and handles synchronous callbacks, but Promise-returning callbacks do not settle while its blocking `Webview.run()` owns the Bun thread. It also lacks the required navigation interception surface.
- `@webviewjs/webview` 0.4.3 documents asynchronous exposure and Wayland support, but native initialization failed in the Wayland session with an unsupported window-handle-kind error.
- `butterframework` 1.6.2 uses an X11-specific Linux shim (`gdkx`, `libX11`, and X11 global-shortcut calls), violating the native-Wayland requirement. Its published compile path also embeds an IPC preamble inconsistent with its current native shim framing.

Feature implementation may proceed for platform-independent code and the proven Linux shell path. macOS-specific shell and release acceptance remain incomplete until executed on macOS arm64.
