# Build and runtime support

## Commands

- `bun run dev` builds the in-memory UI artifact and launches the native shell.
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

Copy only the executable to an empty directory, disable networking, and exercise startup, directory navigation, text/image/generic preview, and shutdown. A missing native WebView stack or Wayland compositor is a startup failure; Crumb never opens a browser tab, starts a local server, or falls back to Chromium/X11.

## macOS

The required initial target is macOS arm64 using the system WKWebView. Exact minimum macOS version, `otool -L` inspection, relocation, and clean-machine acceptance remain pending execution on a macOS arm64 build host and must not be claimed from Linux cross-compilation.
