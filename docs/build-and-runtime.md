# Build and runtime support

This describes Crumb's build pipeline — the template's, not any one application's. The artifacts named below (`dist/crumb-linux-x64`, `dist/crumb-macos-arm64`) are the `file-explorer` example, which is the application the repository currently builds. An application you build on Crumb goes through the same two stages under its own name.

## Commands

- `bun run dev` builds the in-memory UI artifact and launches the application named in `app.config.ts`.
- `bun run build:native` downloads, verifies, patches, and compiles the pinned Linux native addon.
- `bun run build --target=linux-x64` produces `dist/crumb-linux-x64` on Linux x64.
- `bun run build --target=macos-arm64` produces `dist/crumb-macos-arm64` on macOS arm64.
- `bun test` and `bun run typecheck` run the automated verification suite.

Release artifacts must currently be built on their target operating system. The build deliberately fails an attempted cross-platform release rather than emitting an unverified native-addon combination.

## Linux

The verified development host is Ubuntu 26.04 x64 under Wayland. Its direct runtime packages are:

- `libwebkit2gtk-4.1-0`
- `libjavascriptcoregtk-4.1-0`
- `libgtk-3-0t64`

Their normal distribution dependencies supply GLib, Cairo, Pango, GDK-Pixbuf, Wayland, and related libraries. The executable forces GTK's Wayland backend internally. An X server and XWayland are not used and cannot be selected as a fallback. Ubuntu's GTK/WebKitGTK packages may still be dynamically linked to dormant X11 compatibility libraries.

Building the Linux addon requires Rust/Cargo, a C compiler and linker, `pkg-config`, `patch`, GTK 3 development headers, and WebKitGTK 4.1 development headers. On Ubuntu these are provided by `cargo`, `rustc`, `build-essential`, `pkg-config`, `patch`, `libgtk-3-dev`, and `libwebkit2gtk-4.1-dev`. The build downloads one pinned GitHub source archive, verifies its SHA-256 before extraction, applies the repository patch with zero fuzz, and uses Cargo's locked dependency graph. Subsequent builds use the verified cached archive in `.build/`.

Inspect a release with:

```sh
file dist/crumb-linux-x64
ldd .build/nativewindow-webview-v1.0.6/native-window.linux-x64-gnu.node
```

Copy only the executable to an empty directory, disable networking, and exercise startup, directory navigation, text/image/generic preview, and shutdown. A missing native WebView stack or Wayland compositor is a startup failure; a Crumb application never opens a browser tab, starts a local server, or falls back to Chromium/X11. The journey above — directory navigation and preview — is the example's; substitute your own application's primary interactions when verifying a different app.

## macOS

The supported target is Apple Silicon (`arm64`) on macOS 13 or newer using the system WKWebView. The release was verified on macOS 26.5.2 arm64 with Bun 1.4.0. The compiled Bun host declares macOS 13.0 as its minimum; the embedded `@nativewindow/webview-darwin-arm64` addon declares macOS 11.0, so the host determines the effective minimum.

No separate WebView runtime, Rust toolchain, C compiler, Xcode, or Homebrew package is needed to build or run a Crumb application. The macOS native addon is installed as a prebuilt optional dependency by `bun install`. Apple Command Line Tools are needed only for the documented `otool` inspection.

Build and inspect the release on an Apple Silicon Mac:

```sh
bun install
bun run build --target=macos-arm64
file dist/crumb-macos-arm64
otool -L dist/crumb-macos-arm64
```

The verified artifact is a 64-bit arm64 Mach-O executable of approximately 62 MiB. Its outer executable links only `/usr/lib` system libraries; the embedded addon links WebKit, AppKit, ApplicationServices, CoreGraphics, CoreVideo, CoreFoundation, CoreData, CoreText, CoreImage, CloudKit, QuartzCore, Foundation, ColorSync, CoreServices, and standard `/usr/lib` libraries. No adjacent application-owned `.dylib` or `.node` file is required.

The executable was copied alone to `/tmp/crumb-macos-readme-check`, launched from that directory, exercised through the native browse-and-inspect journey, and closed normally. Its runtime path contained no Bun, Node.js, npm, source tree, UI asset, or native-addon lookup. The example has no runtime network operation and the template's default document policy sets `connect-src 'none'`.

The artifact is linker-signed ad hoc rather than Developer ID-signed and notarized. A locally compiled artifact runs normally. For quarantined downloaded artifacts, prefer rebuilding from source; after independently verifying provenance, macOS may offer **Open Anyway** under **System Settings → Privacy & Security**. Crumb applications must not be run with `sudo`.

macOS privacy controls can deny access to Desktop, Documents, Downloads, removable volumes, or other protected locations. This is a recoverable application error, not a startup failure. Grant Files and Folders access to the launching terminal only when the user intentionally wants that access.
