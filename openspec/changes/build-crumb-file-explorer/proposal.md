## Why

Crumb needs an initial implementation that proves a useful, lightweight desktop file explorer can be built with Bun, TypeScript, and the operating system's native WebView. The implementation must make view-only behavior an architectural property while remaining distributable as one executable per supported platform and architecture.

## What Changes

- Add a native desktop shell for macOS and Linux using `@nativewindow/webview`, with an embedded framework-free HTML/CSS/TypeScript interface and no local HTTP server. Linux runs through the native Wayland backend; X11 is not a supported fallback.
- Add read-only location discovery, directory enumeration, metadata inspection, navigation history, keyboard navigation, hidden-file filtering, and recoverable filesystem errors.
- Add bounded, non-executable previews for directories, text, images, and unsupported files.
- Add a responsive and accessible three-pane interface with toolbar, draggable separators, loading states, and light/dark appearance.
- Add a two-stage Bun build that produces standalone macOS arm64 and Linux x64 executables, plus platform dependency and clean-machine verification guidance.
- Begin with a feasibility gate that proves native RPC, embedded UI loading, and standalone packaging on both required targets before the full implementation proceeds.
- Keep Windows, filesystem mutation, persistence, networking, rich document rendering, search, watchers, and platform packaging outside the initial scope.

## Capabilities

### New Capabilities

- `desktop-shell`: Native WebView lifecycle, embedded UI loading, narrow validated RPC, supported-platform detection, and startup/shutdown behavior.
- `filesystem-browsing`: Read-only location discovery, directory listing, selection, navigation, ordering, hidden-file handling, symlinks, and filesystem error recovery.
- `file-preview`: Bounded and safe directory, text, image, and generic metadata previews for untrusted local content.
- `three-pane-interface`: Responsive navigation, directory, and preview panes with toolbar, keyboard behavior, splitters, themes, loading states, and accessibility.
- `standalone-distribution`: Bun-based build, target artifacts, native dependency documentation, and clean-machine single-executable verification.

### Modified Capabilities

None.

## Impact

- Introduces the initial `src/host`, `src/ui`, `src/shared`, `scripts`, and test structure.
- Adds `@nativewindow/webview` as the primary production dependency and TypeScript tooling as development dependencies.
- Adds native runtime dependencies on the operating-system WebView stack; the published Linux binding currently requires GTK 3 and WebKitGTK 4.1 and must initialize with the Wayland GDK backend.
- Establishes a small, explicitly read-only RPC contract between trusted application UI code and the Bun host.
- Adds build and verification workflows for macOS arm64 and Linux x64; additional architectures remain optional follow-up work.
