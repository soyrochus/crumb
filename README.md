<div align="center">
  <img src="./images/crumb-logo-smaller.png" alt="Crumb logo" width="220">

  <p>The template, toolchain, and documentation for shipping a server-less web app as a desktop app.<br>Bun, TypeScript, optional native Rust extensions, and operating-system WebViews. One window, one executable, no Chromium.</p>
  <p>
    <img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-f59e0b">
    <img alt="Bun 1.4.0" src="https://img.shields.io/badge/Bun-1.4.0-000000?logo=bun&amp;logoColor=white">
    <img alt="TypeScript 7.0.2" src="https://img.shields.io/badge/TypeScript-7.0.2-3178c6?logo=typescript&amp;logoColor=white">
    <a href="https://github.com/soyrochus/crumb/actions/workflows/verify.yml"><img alt="Release verification" src="https://github.com/soyrochus/crumb/actions/workflows/verify.yml/badge.svg"></a>
    <img alt="Linux x64" src="https://img.shields.io/badge/Linux-x64-fcc624?logo=linux&amp;logoColor=black">
    <img alt="Linux uses Wayland only" src="https://img.shields.io/badge/Linux-Wayland%20only-7c3aed">
    <img alt="macOS arm64" src="https://img.shields.io/badge/macOS-arm64-999999?logo=apple&amp;logoColor=white">
  </p>
</div>

Crumb is a template you clone. It gives you a native window, an embedded offline document, a narrow validated bridge between your page and a Bun host, first-class support for application-owned Rust extensions, and a build that compiles all of it into one self-contained executable per platform.

If you can build your app as a web page that needs no server, Crumb turns it into a desktop application — without shipping Chromium, without starting a local web server, and without asking anyone to install Bun or Node.js beside the finished binary.

When TypeScript is not enough, declare a Rust crate by logical name in your application config and import it from trusted host code as `app:ext/<name>`. The normal `bun run dev` and `bun run build` commands compile, cache, load, watch, and embed it. There is no separate native packaging workflow and no adjacent `.node` file or Rust toolchain beside the finished executable.

The repository includes two worked applications: `file-explorer` shows the TypeScript-only path, while `activity-monitor` shows the same ordinary web-app structure gaining real operating-system access from an application-owned Rust extension. Both live under `examples/`, separate from the starter you edit.

Crumb is built on [Bun](https://bun.com/) and is, in passing, a practical exploration of Bun as an application toolchain: package management, direct TypeScript execution, browser bundling, automated testing, Node-API compatibility, Cargo orchestration for Rust extensions, and compilation into standalone executables.

> [!IMPORTANT]
> Linux x64 on native Wayland and macOS arm64 are verified. X11 and XWayland are not supported. The executables Crumb produces are currently unsigned and are not packaged as installers or macOS `.app` bundles.

## What Crumb gives you

- One resizable native window using the operating system's own WebView — no bundled Chromium
- Your HTML, CSS, and JavaScript embedded in the executable, loaded without a local server, a network request, or a lookup in the source tree
- A narrow bridge between page and host: only the operations your app declares are reachable, each validated at runtime and each returning a serializable result or a normalized error
- A restrictive Content Security Policy by default, blocking remote connections, frames, object embedding, forms, and unintended navigation
- Optional Rust extensions declared by logical name, automatically compiled with Cargo, watched during development, cached safely per source and target, and imported through stable `app:ext/<name>` modules
- A release build that bundles the UI and compiles it, your host code, every declared Rust extension, and the Bun runtime into one self-contained executable per target
- An executable that runs from an empty directory with no Bun, Node.js, npm, Rust toolchain, source tree, adjacent native addon, or other application file
- No telemetry, settings database, or persistent application state of any kind

## The file-explorer example

A view-only three-pane file browser, shipped in `examples/file-explorer/`. It exists to prove the template end to end and to give you working code to read. None of it is part of what Crumb promises, and none of it is in your way — it is a separate application, not the starting point.

```sh
bun run dev --example=file-explorer
```

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

That last point is the example's own choice, not a limit Crumb imposes. `file-explorer` restricts itself to inspection and bounded reads because that keeps a file browser simple and auditable, and `bun run verify:readonly` enforces it. An app you build on Crumb may read and write freely.

<figure>
  <img src="images/file-explorer-macos.png" alt="The file-explorer example running on macOS">
  <figcaption>The <code>file-explorer</code> example on macOS</figcaption>
</figure>

<figure>
  <img src="images/file-explorer-linux.png" alt="The file-explorer example running on Linux">
  <figcaption>The <code>file-explorer</code> example on Linux</figcaption>
</figure>

## The activity-monitor native-extension example

`examples/activity-monitor/` is the complete worked example for Crumb's Rust path. Its HTML, CSS, and TypeScript remain a conventional client-side interface; an application-owned `system-monitor` crate uses `sysinfo` and `napi-rs` to collect live system and process information asynchronously. Trusted host handlers import it as `app:ext/system-monitor`, normalize its structured output, and expose only three validated, read-only operations to the page.

```sh
bun run dev --example=activity-monitor
```

The example shows CPU and memory totals, load averages, a sortable process list, and per-process detail. Sampling runs outside the window event loop, overlapping refreshes are prevented, shutdown cancels in-flight work, unavailable metrics remain visibly unavailable, and process names are inserted with `textContent`. There is deliberately no operation that kills, suspends, reprioritizes, or otherwise acts on a process.

Building this example requires stable Rust and Cargo; [rustup](https://rustup.rs/) is the recommended installer. The Linux x64 implementation and standalone build are verified. The source is written for Linux and macOS, but the activity-monitor-specific macOS arm64 artifact and relocation check is deferred.

<figure>
  <img src="images/activity-monitor-linux.png" alt="The activity-monitor example running on Linux">
  <figcaption>The <code>activity-monitor</code> example on Linux</figcaption>
</figure>

## Quick start

### Requirements

- [Bun](https://bun.com/) 1.4 or newer
- A supported native WebView stack
- Apple Silicon with macOS 13 or newer, or Ubuntu 26.04 x64 with a native Wayland session
- A stable Rust toolchain with `rustc` and Cargo for clean Linux builds and whenever an application declares a Rust extension; [rustup](https://rustup.rs/) is the recommended installer

Install dependencies and run:

```sh
bun install
bun run dev
```

A window opens showing the **starter** — a minimal application in `src/app/`: one page, one declared operation, and a button that calls the Bun host. It is about forty lines you can read in full before changing anything, and it is what you edit to build your own app.

For a step-by-step walkthrough of the application structure, browser-to-host bridge, Rust extensions, development loop, and standalone release build, see [How to build a desktop app with Bun](docs/how-to-build-a-desktop-app-with-bun.md).

To see the complete Rust path — declaration, automatic Cargo build, logical import, host operation, and embedded release fixture — run:

```sh
bun run dev --example=native-probe
```

This requires the Rust and platform linker setup documented under [Rust native extensions](#rust-native-extensions).

To see something substantial, run the worked example:

```sh
bun run dev --example=file-explorer
```

That is the three-pane file browser in the screenshots below. It lives in `examples/file-explorer/` and you never have to delete it — it is a separate application, not something in your way.

To see the substantial native-extension example, run:

```sh
bun run dev --example=activity-monitor
```

The first run compiles its Rust crate. Later runs reuse the verified cached addon until its Rust sources or lockfile change.

## Bun in this project

[Bun](https://bun.com/) is more than the runtime your app happens to sit on — it is the whole toolchain Crumb is built from. Every stage below is Bun doing a job that would otherwise need a separate tool:

| Bun feature | How the toolchain uses it |
| --- | --- |
| Package manager | `bun install` installs the pinned JavaScript dependencies from `bun.lock` |
| TypeScript runtime | Development and build scripts run directly from `.ts` files |
| Bundler | `Bun.build()` bundles the browser UI into one embedded HTML artifact |
| Executable compiler | `Bun.build({ compile: ... })` produces a standalone host executable containing Bun, the UI, and your application code |
| Test runner | `bun test` runs the template's platform and validation tests alongside the example's filesystem, preview, and state tests |
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

Any download, checksum, patch, or compilation failure stops the command. The build does not fall back to the unpatched published Linux addon.

The generated addon is cached after a successful build. If `.build/nativewindow-webview-v1.0.6/native-window.linux-x64-gnu.node` already exists, the current script trusts it and skips rebuilding. A normal Git clone cannot inherit that file, but a copied working directory can. Remove the generated addon before running `bun run build:native` when you need to force a clean native rebuild.

## macOS setup

Crumb supports Apple Silicon (`arm64`) on macOS 13 or newer and uses the WKWebView included with macOS. A TypeScript-only application needs no separate WebView runtime, Rust toolchain, C compiler, Xcode, or Homebrew package for ordinary development or release builds. The verified host is macOS 26.5.2 arm64 with Bun 1.4.0; the generated executable declares macOS 13.0 as its minimum deployment version.

Declaring a Rust extension adds build-time requirements: a stable Rust toolchain containing `rustc` and Cargo, plus Apple Command Line Tools for the linker, SDK, `install_name_tool`, and release inspection. [rustup](https://rustup.rs/) is the recommended way to install and update the Rust toolchain; Homebrew is not required. Install both toolchains, follow the `rustup` prompts, and verify them:

```sh
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustup default stable
rustc --version
cargo --version
```

The probe was verified with Rust 1.97.1 and Command Line Tools at `/Library/Developer/CommandLineTools`; full Xcode is not required.

Confirm the machine and runtime before installing dependencies:

```sh
uname -m
sw_vers -productVersion
bun --version
```

`uname -m` must print `arm64`. Then install the pinned packages and launch the development build:

```sh
bun install
bun run dev
```

Development loads the prebuilt `@nativewindow/webview-darwin-arm64` binding from `node_modules`; the Linux-only native patch and GTK packages are not involved. Close the window to stop the development process.

The `file-explorer` example discovers Home, existing common directories, root, and accessible children of `/Volumes`. macOS may restrict Desktop, Documents, Downloads, removable volumes, or other protected locations. The example reports those failures without requesting elevated privileges. If access is desired, grant it to the terminal application used to launch it under **System Settings → Privacy & Security → Files and Folders** (or Full Disk Access only when intentionally required).

## Linux setup

The initial supported Linux distribution is Ubuntu 26.04 x64 with GTK 3, WebKitGTK 4.1, and native Wayland. Other distributions may work when they provide equivalent libraries, but are not part of the verified support matrix.

Install the runtime and build dependencies on Ubuntu:

```sh
sudo apt install \
  build-essential \
  curl \
  libgtk-3-dev \
  libjavascriptcoregtk-4.1-0 \
  libwebkit2gtk-4.1-dev \
  patch \
  pkg-config
```

Install the stable Rust toolchain with [rustup](https://rustup.rs/) rather than depending on the distribution's potentially older `cargo` and `rustc` packages:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustup default stable
rustc --version
cargo --version
```

Rust is required for a clean Linux build because Crumb compiles its pinned native Wayland binding; the same toolchain also builds any application-declared extensions. Crumb forces `GDK_BACKEND=wayland` internally. It will not fall back to X11 or XWayland. Distribution GTK and WebKitGTK packages may still contain dormant links to X11 compatibility libraries; those links are not used as Crumb's display backend.

## Build standalone executables

Release artifacts must currently be built on their target operating system.

The artifact is named after the application being built — `bun run build` produces `dist/starter-<target>`, and `--example=file-explorer` produces `dist/file-explorer-<target>`. Pass `--output=<name>` to choose the stem yourself.

```sh
bun run build --target=macos-arm64                        # dist/starter-macos-arm64
bun run build --example=file-explorer --target=macos-arm64 # dist/file-explorer-macos-arm64
bun run build --example=file-explorer --output=crumb --target=macos-arm64
```

### Linux x64

```sh
bun run build --example=file-explorer --target=linux-x64
./dist/file-explorer-linux-x64
```

### macOS arm64

```sh
bun run build --example=file-explorer --target=macos-arm64
file dist/file-explorer-macos-arm64
otool -L dist/file-explorer-macos-arm64
./dist/file-explorer-macos-arm64
```

The expected `file` result is a 64-bit arm64 Mach-O executable. `otool -L` must list only macOS system libraries; the embedded native addon uses the system WebKit, AppKit, and related Apple frameworks. `otool` is a release-inspection tool supplied by Apple Command Line Tools (`xcode-select --install`), but those tools are not required merely to build or run Crumb.

To verify that no application files are required beside the executable:

```sh
CRUMB_CHECK_DIR="$(mktemp -d)"
cp dist/file-explorer-macos-arm64 "$CRUMB_CHECK_DIR/"
cd "$CRUMB_CHECK_DIR"
./file-explorer-macos-arm64
```

The relocated executable has been verified from an otherwise empty directory without Bun, Node.js, npm, the repository, or network access in its runtime path. It is approximately 62 MiB because it embeds Bun, the host, the UI, and the native binding.

The raw executable is linker-signed ad hoc, not signed with an Apple Developer ID, and not notarized. A locally built executable runs normally. If a downloaded copy is quarantined, the safest option is to build it from source; otherwise, verify its provenance and use **System Settings → Privacy & Security → Open Anyway** if macOS offers that control. Never run it with `sudo`.

The resulting executable contains the Bun runtime, host code, browser UI, CSS, and application-owned assets. It does not require Bun, Node.js, the source tree, or adjacent application files at runtime. Native system WebView libraries remain operating-system dependencies.

## Using the file-explorer example

These instructions describe the example application, not the template.

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

## Preview behavior in the example

The example treats names, paths, metadata, and file contents as untrusted data.

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

Every Crumb application has two layers — the template supplies the outer three rows, your code supplies the handlers:

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

The WebView can call only the operations declared in `app.config.ts` — nothing else is reachable, and every input is validated before a handler runs. An operation absent from that table has no route to a handler. There is no generic filesystem binding and no eval-style bridge. The embedded document also uses a restrictive Content Security Policy that blocks external connections, frames, objects, forms, and unintended scripts.

The `file-explorer` example declares four operations:

- `getPlatformInfo`
- `getLocations`
- `listDirectory`
- `getPreview`

All four are read-only, and `bun run verify:readonly` statically checks the file-explorer's TypeScript under `examples/file-explorer/src/` for mutation, whole-file generic reads, and shell execution. It scans host-language source only. It does not inspect Rust or make any claim about a native extension, so an application combining a read-only policy with an extension must review that native code separately. The check belongs to the example; your application declares its own operations in `app.config.ts` and is not bound by it.

### Rust native extensions

An application can declare an application-owned Rust Node-API `cdylib` by logical name. The complete walkthrough is in [How to build a desktop app with Bun — Add a Rust native extension](docs/how-to-build-a-desktop-app-with-bun.md#8-add-a-rust-native-extension-optional).

Install a stable Rust toolchain with [rustup](https://rustup.rs/) and make sure both commands resolve in the terminal that runs Bun:

```sh
rustc --version
cargo --version
```

Put a starter application's crate under `src/app/native/<name>/`. A registered application under `examples/<app>/` normally owns crates under `examples/<app>/native/<name>/`. The crate must have a valid `Cargo.toml`, produce a `cdylib`, and commit a `Cargo.lock` because Crumb invokes `cargo build --release --locked`.

```toml
[package]
name = "my-extension"
version = "0.1.0"
edition = "2024"

[lib]
name = "my_extension"
crate-type = ["cdylib"]
```

The library must expose Node-API exports that Bun can load. A plain Rust `cdylib` with no Node-API module initializer will compile but cannot be imported as an extension. Start from the dependency-free reference files in [`src/app/native/probe/`](./src/app/native/probe/), including its macOS linker setup in `build.rs`, then replace the example `answer()` export with your implementation. After changing dependencies, regenerate and commit the lockfile:

```sh
cargo generate-lockfile --manifest-path src/app/native/my-extension/Cargo.toml
```

Declare source intent in the application's `ApplicationConfig`. Paths are relative to the repository root; do not put `.node`, `.so`, `.dylib`, a target name, or an output path in the declaration. Crumb derives and verifies all target-specific artifact locations.

```ts
export const application: ApplicationConfig = {
  // ...window, CSP, entries, and operations...
  nativeExtensions: {
    "system-info": "src/app/native/my-extension",
  },
};
```

Logical names must start with a lowercase letter and contain only lowercase letters, digits, `-`, or `_`. Import the declared extension from trusted host code with the same logical module on every platform. Check its runtime export and normalize the result before returning it through a declared operation:

```ts
import systemInfo from "app:ext/system-info";

const readSystemInfo = systemInfo.readSystemInfo;
if (typeof readSystemInfo !== "function") {
  throw new Error('Native extension "system-info" does not export readSystemInfo()');
}
const result = readSystemInfo();
```

The permanent `native-probe` fixture demonstrates the smallest dependency-free shape in [`examples/native-probe/`](./examples/native-probe/) and [`src/app/native/probe/`](./src/app/native/probe/). The [`activity-monitor` example](./examples/activity-monitor/) demonstrates the production-shaped path: `napi-rs` objects, asynchronous tasks, a third-party Rust dependency, repeated calls, shutdown cancellation, structured normalization, and a complete UI.

The ordinary commands own the native build; do not run `cargo build` as a separate prerequisite. For the default starter:

```sh
bun run dev
bun run rebuild:extensions
bun run build --target=macos-arm64  # run on Apple Silicon macOS
bun run build --target=linux-x64    # run on Linux x64
```

For a named registered application, add `--example=<app>` to the Crumb commands. Cross-compilation is not supported: build each release on its target operating system. Release builds embed every declared extension in the standalone executable and report non-system dynamic libraries introduced by an extension.

Extension source is watched during `bun run dev`. A native change compiles the crate and restarts the host process; native code is never replaced inside a running process. UI-only changes reuse the verified artifact. A successful artifact is accepted only when its source fingerprint, extension name, target, architecture, and digest match its provenance metadata. Use `bun run rebuild:extensions --example=<app>` for a forced clean extension rebuild after changing toolchains, linker settings, or dependencies.

Native extensions are trusted host code. They run in the Bun process with its full operating-system permissions, can read or write files, use the network, and crash or terminate the application. They do not create a WebView-native bridge: page input still reaches native code only through declared operations and their validators.

Register cleanup with `registerShutdownHandler` from `src/kit/host/shutdown.ts`. Handlers run once in registration order when the window closes. Failures are reported without skipping later handlers; the whole shutdown phase is bounded to 3 seconds, after which the incomplete handler is named and the process exits anyway.

Measured on the verified macOS arm64 host, the dependency-free probe took 2.12 seconds for a cold release compile, 0.61 seconds for an incremental forced compile, and 1.4 milliseconds for a verified warm-cache lookup. Real extensions with dependencies will cost more. The release build reports non-system dynamic dependencies; the probe adds none.

On the Linux x64 implementation host, the first optimized `activity-monitor` extension compile with `sysinfo` and `napi-rs` took 8.2 seconds. A verified warm-cache lookup took 2.2 milliseconds and the subsequent selected-application build completed in 0.18 seconds. These are observations, not performance guarantees; macOS arm64 timing remains deferred with its platform check.

### Developer tools

`bun run dev` enables the WebView's developer tools so you can inspect the page you are building. Release builds disable them, and no application configuration can turn them back on — the flag comes from the launch path, not from `app.config.ts`, so a released executable cannot ship an inspectable WebView.

### Native Wayland patch

The published `@nativewindow/webview` 1.0.6 Linux addon attaches WebKitGTK to Tao's already-occupied top-level GTK window, producing a gray window. Crumb builds a checksum-pinned minimal fork that attaches the WebView to Tao's default content box instead.

The patch is stored at [`native/nativewindow-webview-v1.0.6-wayland.patch`](./native/nativewindow-webview-v1.0.6-wayland.patch). The build verifies the pinned upstream archive before applying the patch with zero fuzz.

## Development commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Build and launch the default application, watching for changes |
| `bun run dev --example=file-explorer` | Run a named application instead |
| `bun run dev --example=activity-monitor` | Run the Rust-backed activity monitor example |
| `bun run dev --no-watch` | Run once without watching |
| `bun run build:native` | Build the patched Linux native addon |
| `bun run rebuild:extensions --example=<name>` | Clean and rebuild a selected application's declared extensions |
| `bun run build:ui` | Build `dist/ui.html` |
| `bun run build --target=linux-x64` | Build the Linux standalone executable |
| `bun run build --example=<name> --target=<target>` | Build a named application; the artifact is named after it |
| `bun run build --output=<name> …` | Override the artifact's filename stem |
| `bun run build --target=macos-arm64` | Build the macOS standalone executable |
| `bun test` | Run the automated test suite |
| `bun run typecheck` | Run strict TypeScript checks |
| `bun run verify:performance` | Run bounded host and native 5,000-row UI performance checks |
| `bun run verify:readonly` | Verify the production read-only boundary |

## Project structure

```text
src/kit/       The template: window bootstrap, RPC router and browser bridge,
               validation primitives, platform detection, transport types
src/app/       The starter — a minimal application. This is what you edit.
examples/
  file-explorer/  TypeScript-only worked example, with its own config and tests
  activity-monitor/ Rust native-extension worked example and system-monitor crate
  native-probe/   Permanent end-to-end fixture for native extensions
app.config.ts  Registry of available applications and which one is default
main.ts        Release entry point: hands an application to the kit
scripts/       Development supervisor, runner, native, UI, and build scripts
native/        Minimal pinned native binding patch
test/kit/      Template tests: platform, validation, RPC surface, selection,
               and the release developer-tools invariant
docs/          Build, runtime, and feasibility notes
openspec/      Change proposals, design, requirements, and task tracking
images/        Crumb artwork
```

Nothing under `src/kit/` imports from `src/app/`, and the kit names no operation. Moving `src/app/` aside leaves the kit typechecking cleanly — that is a test, not an aspiration.

## Verification

These local commands are the per-change check. Automated verification runs only when a version tag is published — a run compiles the Linux native addon from source and builds every application on both platforms, which is too costly to spend on every push.

Run the complete local checks:

```sh
bun test
bun run typecheck
bun run verify:performance
bun run verify:readonly
```

The current suite contains 98 automated tests and 234 expectations covering filesystem behavior, validation, previews, navigation state, activity-monitor formatting and refresh coordination, supported platforms, shutdown, extension declarations, cache safety, watching, and the production capability boundary. The performance command briefly opens a native window and closes it automatically. The complete pre-activity-monitor suite and relocated `native-probe` extension journey are verified on macOS arm64 and Ubuntu 26.04 x64/Wayland; both relocated probe executables returned `nativeProbeAnswer: 42`. The activity monitor's Rust tests, TypeScript tests, real-data addon calls, embedded release build, and relocated launch are verified on Linux x64; its macOS arm64 application check is deferred. Fixtures are created only below the operating system's temporary directory and are removed after each run.

## Current limitations

These apply to anything you build with Crumb:

- Windows is not supported.
- Linux requires a native Wayland session; X11 and XWayland are not supported.
- Intel Macs are not supported; the macOS release target is arm64 only.
- Releases must be built on their target operating system.
- Release binaries are currently unsigned and are not packaged as installers or macOS application bundles.
- One window per application; multiple windows are not yet supported.
- Native extensions are source-built on the target operating system; cross-compilation and prebuilt reusable extensions are not supported yet.

These apply only to the `file-explorer` example and disappear when you delete it:

- Search, file watching, tabs, and custom sorting are out of scope.
- The example does not edit, launch, copy, move, rename, or delete files.
- PDF, audio, video, archives, Office documents, and SVG receive metadata-only previews.

## Troubleshooting

### Linux window does not open

Confirm that the session is using Wayland and that GTK 3 and WebKitGTK 4.1 are installed. If `GDK_BACKEND` is set, it must be `wayland`.

```sh
echo "$XDG_SESSION_TYPE"
echo "$GDK_BACKEND"
```

### Native addon fails to build

Check that `rustc`, Cargo, a C toolchain, `pkg-config`, `patch`, and the GTK/WebKitGTK development packages are installed. If Rust was installed with [rustup](https://rustup.rs/) in the current shell, `. "$HOME/.cargo/env"` makes its commands available. Then run:

```sh
bun run build:native
```

For an application extension, confirm that its `Cargo.toml` declares `crate-type = ["cdylib"]`, its `Cargo.lock` is current, and its repository-relative source directory matches `nativeExtensions`. Force a clean rebuild with:

```sh
bun run rebuild:extensions --example=native-probe
```

### macOS reports `bad CPU type in executable`

The macOS artifact requires Apple Silicon. Confirm that `uname -m` prints `arm64`; Intel (`x86_64`) Macs are not supported.

### macOS reports `permission denied`

Preserve or restore the executable bit, then run the binary without `sudo`:

```sh
chmod +x dist/file-explorer-macos-arm64
./dist/file-explorer-macos-arm64
```

If the example opens but a protected folder is unavailable, review the macOS privacy guidance in [macOS setup](#macos-setup). Filesystem permission errors are recoverable and the example does not change permissions.

### macOS cannot verify the developer

Release binaries are not Developer ID-signed or notarized. Prefer building from source. For a binary whose provenance you have independently verified, macOS may provide **Open Anyway** under **System Settings → Privacy & Security**.

### macOS native addon is unavailable

Run `bun install` on the Apple Silicon Mac and confirm that this file exists:

```sh
file node_modules/@nativewindow/webview-darwin-arm64/native-window.darwin-arm64.node
```

It must be an arm64 Mach-O library. Do not reuse `node_modules` copied from Linux or an Intel Mac.

### Verify Linux native dependencies

```sh
file dist/file-explorer-linux-x64
ldd .build/nativewindow-webview-v1.0.6/native-window.linux-x64-gnu.node
```

No dependency should be reported as `not found`.

---

## Principles of Participation

Everyone is invited and welcome to contribute: open issues, propose pull requests, share ideas, or help improve documentation. Participation is open to all, regardless of background or viewpoint.

This project follows the [FOSS Pluralism Manifesto](./FOSS_PLURALISM_MANIFESTO.md), which affirms respect for people, freedom to critique ideas, and space for diverse perspectives.

Keep changes aligned with Crumb's core constraints: native WebViews, an embedded offline document, a narrow declared and validated host surface, no local server, no network dependency at runtime, and no X11/XWayland fallback on Linux.

The `file-explorer` example carries two constraints of its own that Crumb does not impose on you: view-only filesystem access and bounded reads. Keep those intact when changing the example — but do not treat them as rules for an application you build on the template.

Before submitting a change, run the verification commands above and update the relevant OpenSpec artifacts when behavior or requirements change.

## License and Copyright

Copyright (c) 2026 Iwan van der Kleijn

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
