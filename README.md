<div align="center">
  <img src="./images/crumb-logo-smaller.png" alt="Crumb logo" width="220">
  <h1>Crumb</h1>
  <p>A small, view-only desktop file explorer built with Bun, TypeScript, and native operating-system WebViews.</p>
  <p>
    <img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-f59e0b">
    <img alt="Bun 1.4.0" src="https://img.shields.io/badge/Bun-1.4.0-000000?logo=bun&amp;logoColor=white">
    <img alt="TypeScript 7.0.2" src="https://img.shields.io/badge/TypeScript-7.0.2-3178c6?logo=typescript&amp;logoColor=white">
    <img alt="36 tests passing" src="https://img.shields.io/badge/tests-36%20passing-22c55e">
    <img alt="Linux x64" src="https://img.shields.io/badge/Linux-x64-fcc624?logo=linux&amp;logoColor=black">
    <img alt="Linux uses Wayland only" src="https://img.shields.io/badge/Linux-Wayland%20only-7c3aed">
    <img alt="macOS arm64" src="https://img.shields.io/badge/macOS-arm64-999999?logo=apple&amp;logoColor=white">
  </p>
</div>

Crumb provides a lightweight three-pane interface for browsing directories and inspecting files. It uses the operating system's WebView instead of bundling Chromium, exposes a narrow read-only host API, and can be compiled into one executable per target platform.

> [!IMPORTANT]
> Linux x64 on native Wayland is verified. X11 and XWayland are not supported. The macOS arm64 target is implemented but still requires native build and runtime acceptance testing.

## Features

- Three-pane layout for locations, directory contents, and previews
- Home, root, common folders, and mounted-location discovery
- Back, Forward, parent-directory, and sidebar navigation
- Hidden-file toggle with clear on/off state
- Natural, case-insensitive sorting with directories first
- Text, image, directory, and generic metadata previews
- Symlink and broken-link information
- Light and dark appearance
- Keyboard navigation and accessible pane separators
- Recoverable handling of missing files, removed volumes, and permission errors
- No file creation, editing, deletion, renaming, moving, or shell execution
- No local server, network service, telemetry, settings database, or persistent history

## Quick start

### Requirements

- [Bun](https://bun.com/) 1.4 or newer
- A supported native WebView stack
- Linux x64 with a Wayland session, or macOS arm64

Install dependencies and launch Crumb:

```sh
bun install
bun run dev
```

## Bun in this project

[Bun](https://bun.com/) is more than Crumb's JavaScript runtime. This project is partly a practical demonstration of Bun's integrated toolchain:

| Bun feature | How Crumb uses it |
| --- | --- |
| Package manager | `bun install` installs the pinned JavaScript dependencies from `bun.lock` |
| TypeScript runtime | Development and build scripts run directly from `.ts` files |
| Bundler | `Bun.build()` bundles the browser UI into one embedded HTML artifact |
| Executable compiler | `Bun.build({ compile: ... })` produces a standalone host executable containing Bun, the UI, and application code |
| Test runner | `bun test` runs the filesystem, preview, validation, state, and platform tests |
| Web and runtime APIs | `fetch`, `Bun.file`, `Bun.write`, and `Bun.CryptoHasher` download, store, and verify native source |
| Process API | `Bun.spawn` runs `tar`, `patch`, and Cargo while preserving their exit status |
| Node-API compatibility | The Bun host loads the compiled native WebView addon directly |

### How Bun applies the native Wayland patch

Both Linux entry paths call the same `buildNativeAddon()` function:

```text
bun run dev
└── scripts/dev.ts
    └── buildNativeAddon()

bun run build --target=linux-x64
└── scripts/build.ts
    └── buildNativeAddon()
```

On a clean clone, `.build/` is absent because it is ignored by Git. Bun therefore performs this sequence:

1. Download the source archive for one pinned `@nativewindow/webview` commit.
2. Calculate its SHA-256 digest with `Bun.CryptoHasher`.
3. Stop if the digest does not match the value pinned in [`scripts/build-native.ts`](./scripts/build-native.ts).
4. Extract a fresh source tree.
5. Apply [`native/nativewindow-webview-v1.0.6-wayland.patch`](./native/nativewindow-webview-v1.0.6-wayland.patch) using `patch --fuzz=0`.
6. Run `cargo build --release --locked`.
7. Store the resulting Node-API addon in `.build/`.
8. Load that addon for development or embed it in the standalone Linux executable.

Any download, checksum, patch, or compilation failure stops the command. Crumb does not fall back to the unpatched published Linux addon.

The generated addon is cached after a successful build. If `.build/nativewindow-webview-v1.0.6/native-window.linux-x64-gnu.node` already exists, the current script trusts it and skips rebuilding. A normal Git clone cannot inherit that file, but a copied working directory can. Remove the generated addon before running `bun run build:native` when you need to force a clean native rebuild.

## Linux setup

Crumb has been verified on Ubuntu 26.04 x64 with GTK 3, WebKitGTK 4.1, and native Wayland.

Install the runtime and build dependencies on Ubuntu:

```sh
sudo apt install \
  build-essential \
  cargo \
  libgtk-3-dev \
  libjavascriptcoregtk-4.1-0 \
  libwebkit2gtk-4.1-dev \
  patch \
  pkg-config \
  rustc
```

Crumb forces `GDK_BACKEND=wayland` internally. It will not fall back to X11 or XWayland. Distribution GTK and WebKitGTK packages may still contain dormant links to X11 compatibility libraries; those links are not used as Crumb's display backend.

## Build standalone executables

Release artifacts must currently be built on their target operating system.

### Linux x64

```sh
bun run build --target=linux-x64
./dist/crumb-linux-x64
```

### macOS arm64

```sh
bun run build --target=macos-arm64
./dist/crumb-macos-arm64
```

The resulting executable contains the Bun runtime, host code, browser UI, CSS, and application-owned assets. It does not require Bun, Node.js, the source tree, or adjacent application files at runtime. Native system WebView libraries remain operating-system dependencies.

## Using Crumb

- Select a location in the left pane to open it.
- Select a directory entry once to preview it.
- Double-click a directory, or select it and press Enter, to open it.
- Press Escape to clear the current selection.
- Use the **Hidden: On/Off** button to show or hide dotfiles.
- Drag either separator to resize its adjacent panes. Focused separators also respond to the arrow keys.

### Keyboard shortcuts

| Action | Linux | macOS |
| --- | --- | --- |
| Move through entries | `Up` / `Down` | `Up` / `Down` |
| First or last entry | `Home` / `End` | `Home` / `End` |
| Open selected directory | `Enter` | `Enter` |
| Clear selection | `Escape` | `Escape` |
| Parent directory | `Ctrl` + `Up` | `Command` + `Up` |
| Back | `Ctrl` + `[` | `Command` + `[` |
| Forward | `Ctrl` + `]` | `Command` + `]` |
| Toggle hidden files | `Ctrl` + `Shift` + `.` | `Command` + `Shift` + `.` |

## Preview behavior

Crumb treats names, paths, metadata, and file contents as untrusted data.

| Content | Behavior |
| --- | --- |
| Directories | Shows metadata and a bounded direct-child count; never calculates recursive size |
| Text | Reads at most 1 MiB and renders it as inert text |
| Unknown files | Samples at most 8 KiB to distinguish text from binary content |
| PNG, JPEG, GIF, WebP | Validates the file signature and previews files up to 25 MiB |
| SVG, HTML, JavaScript | Never executes content; SVG receives a generic metadata preview |
| Unsupported files | Shows available metadata without interpreting the complete file |

Directory listings contain at most 50,000 entries and never recurse automatically.

## Architecture

Crumb has two application layers:

```text
Native window and WebView
└── Embedded HTML, CSS, and browser TypeScript
    └── Validated JSON RPC
        └── Bun host
            ├── Location discovery
            ├── Directory inspection
            ├── Bounded preview generation
            └── Native window lifecycle
```

The WebView can call only four host operations:

- `getPlatformInfo`
- `getLocations`
- `listDirectory`
- `getPreview`

There is no generic filesystem binding. Production source is statically checked for mutation, whole-file generic reads, and shell execution. The embedded document also uses a restrictive Content Security Policy that blocks external connections, frames, objects, forms, and unintended scripts.

### Native Wayland patch

The published `@nativewindow/webview` 1.0.6 Linux addon attaches WebKitGTK to Tao's already-occupied top-level GTK window, producing a gray window. Crumb builds a checksum-pinned minimal fork that attaches the WebView to Tao's default content box instead.

The patch is stored at [`native/nativewindow-webview-v1.0.6-wayland.patch`](./native/nativewindow-webview-v1.0.6-wayland.patch). The build verifies the pinned upstream archive before applying the patch with zero fuzz.

## Development commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Build the embedded UI and launch Crumb |
| `bun run build:native` | Build the patched Linux native addon |
| `bun run build:ui` | Build `dist/ui.html` |
| `bun run build --target=linux-x64` | Build the Linux standalone executable |
| `bun run build --target=macos-arm64` | Build the macOS standalone executable |
| `bun test` | Run the automated test suite |
| `bun run typecheck` | Run strict TypeScript checks |
| `bun run verify:readonly` | Verify the production read-only boundary |

## Project structure

```text
src/host/      Trusted Bun host, filesystem inspection, previews, and RPC
src/shared/    Serializable contracts and runtime validation
src/ui/        Embedded browser interface and transient application state
scripts/       Development, native, UI, and release build scripts
native/        Minimal pinned native binding patch
test/          Filesystem, validation, preview, state, and platform tests
docs/          Build, runtime, and feasibility notes
openspec/      Change proposal, design, requirements, and task tracking
images/        Crumb artwork
```

## Verification

Run the complete local checks:

```sh
bun test
bun run typecheck
bun run verify:readonly
```

The current suite contains 36 automated tests covering filesystem behavior, validation, previews, navigation state, supported platforms, and the production capability boundary.

## Current limitations

- Windows is not supported.
- Linux requires a native Wayland session.
- macOS arm64 packaging and clean-machine acceptance are not yet verified.
- Search, file watching, tabs, multiple windows, and custom sorting are out of scope.
- Crumb does not edit, launch, copy, move, rename, or delete files.
- PDF, audio, video, archives, Office documents, and SVG receive metadata-only previews.
- Release binaries are currently unsigned and are not packaged as installers or macOS application bundles.

## Troubleshooting

### Linux window does not open

Confirm that the session is using Wayland and that GTK 3 and WebKitGTK 4.1 are installed. If `GDK_BACKEND` is set, it must be `wayland`.

```sh
echo "$XDG_SESSION_TYPE"
echo "$GDK_BACKEND"
```

### Native addon fails to build

Check that Rust, Cargo, a C toolchain, `pkg-config`, `patch`, and the GTK/WebKitGTK development packages are installed. Then run:

```sh
bun run build:native
```

### Verify Linux native dependencies

```sh
file dist/crumb-linux-x64
ldd .build/nativewindow-webview-v1.0.6/native-window.linux-x64-gnu.node
```

No dependency should be reported as `not found`.

## Contributing

Keep changes aligned with Crumb's core constraints: view-only filesystem access, bounded reads, native WebViews, no local server, no network dependency at runtime, and no X11/XWayland fallback on Linux.

Before submitting a change, run the verification commands above and update the relevant OpenSpec artifacts when behavior or requirements change.
