# Rust native extensions

Use a Rust extension when trusted host work needs native performance, an existing native library, or operating-system access that is impractical in TypeScript. Extensions run inside the Bun host process and are reached only from trusted host code. The WebView still calls a declared, validated operation; it never imports or selects native modules itself.

This document continues [How to build a desktop app with Bun](./how-to-build-a-desktop-app-with-bun.md), which covers the interface, the operation bridge, and the release build. Read that first: an extension is always reached through a declared operation, so its four parts — contract, validator, handler, table entry — are prerequisites here.
## Install Rust and the platform linker

Install a stable Rust toolchain with [rustup](https://rustup.rs/), then follow its prompts:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustup default stable
rustc --version
cargo --version
```

On Apple Silicon macOS, also install Apple Command Line Tools. They provide the linker, SDK, and release-inspection tools; full Xcode and Homebrew are not required:

```sh
xcode-select --install
```

On Linux, install the non-Rust system requirements — the C toolchain, GTK/WebKitGTK development packages, `patch`, and `pkg-config` — from [Build and runtime support](./build-and-runtime.md#linux), and use the `rustup` toolchain above for Rust. Releases are built on their target operating system: macOS arm64 on Apple Silicon macOS, and Linux x64 on Linux. Crumb does not cross-compile native extensions.

## Create a Node-API `cdylib`

For the starter application, put the crate below `src/app/native/`. This dependency-free example exports an `answer()` function returning `42`:

```text
src/app/native/answer/
├── Cargo.toml
├── Cargo.lock
├── build.rs
└── src/
    └── lib.rs
```

Create `src/app/native/answer/Cargo.toml`:

```toml
[package]
name = "desktop-answer"
version = "0.1.0"
edition = "2024"

[lib]
name = "desktop_answer"
crate-type = ["cdylib"]

[profile.release]
strip = "symbols"
```

The `cdylib` setting is required. On macOS, Node-API symbols are supplied by Bun when it loads the addon, so `src/app/native/answer/build.rs` must allow those symbols to be resolved dynamically:

```rust
fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-undefined");
        println!("cargo:rustc-cdylib-link-arg=-Wl,dynamic_lookup");
    }
}
```

Add the minimal Node-API module in `src/app/native/answer/src/lib.rs`:

```rust
#![allow(non_camel_case_types)]

use std::ffi::{c_char, c_void};

type napi_env = *mut c_void;
type napi_value = *mut c_void;
type napi_callback_info = *mut c_void;
type napi_status = i32;
type napi_callback = Option<unsafe extern "C" fn(napi_env, napi_callback_info) -> napi_value>;

unsafe extern "C" {
    fn napi_create_int32(env: napi_env, value: i32, result: *mut napi_value) -> napi_status;
    fn napi_create_function(
        env: napi_env,
        utf8name: *const c_char,
        length: usize,
        callback: napi_callback,
        data: *mut c_void,
        result: *mut napi_value,
    ) -> napi_status;
    fn napi_set_named_property(
        env: napi_env,
        object: napi_value,
        utf8name: *const c_char,
        value: napi_value,
    ) -> napi_status;
}

unsafe extern "C" fn answer(env: napi_env, _info: napi_callback_info) -> napi_value {
    let mut result = std::ptr::null_mut();
    unsafe { napi_create_int32(env, 42, &mut result) };
    result
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_register_module_v1(env: napi_env, exports: napi_value) -> napi_value {
    let name = c"answer";
    let mut function = std::ptr::null_mut();
    unsafe {
        napi_create_function(
            env,
            name.as_ptr(),
            name.to_bytes().len(),
            Some(answer),
            std::ptr::null_mut(),
            &mut function,
        );
        napi_set_named_property(env, exports, name.as_ptr(), function);
    }
    exports
}
```

A native extension must expose a Node-API module initializer such as `napi_register_module_v1`; an ordinary Rust `cdylib` with no Node-API exports cannot be imported by Bun. The permanent [`native-probe`](../src/app/native/probe/) fixture contains these same files as a working reference.

Generate and commit the lockfile. Crumb deliberately builds with `--locked`, so an absent or stale `Cargo.lock` stops the build:

```sh
cargo generate-lockfile --manifest-path src/app/native/answer/Cargo.toml
```

## Declare and call the extension

Add `nativeExtensions` to `src/app/app.config.ts`. The key is the stable logical import name; the value is the crate's source directory relative to the repository root:

```ts
export const starter: ApplicationConfig = {
  // ...window, CSP, entries, and operations...
  nativeExtensions: {
    answer: "src/app/native/answer",
  },
};
```

Declare source only. Do not put `.node`, `.so`, `.dylib`, a target suffix, or a build-output path in this configuration. Logical names must start with a lowercase letter and contain only lowercase letters, digits, `-`, or `_`.

Import the logical module from trusted host code, for example in `src/app/host/handlers.ts`:

```ts
import answerExtension from "app:ext/answer";

export const handlers = {
  nativeAnswer(): { answer: number } {
    const answer = answerExtension.answer;
    if (typeof answer !== "function") {
      throw new Error('Native extension "answer" does not export answer()');
    }

    const value = answer();
    if (typeof value !== "number") {
      throw new Error('Native extension "answer" returned an invalid value');
    }
    return { answer: value };
  },
};
```

Add a shared operation contract, runtime validator, and `operation(...)` entry exactly as in sections 4 and 5. Validate WebView input before the handler calls native code, and return only serializable values. Never expose a generic native-module name, artifact path, or arbitrary native invocation to the page.

## Develop, rebuild, and release

The normal development command validates the declaration, builds a missing or stale crate, loads it under `app:ext/answer`, and opens the application:

```sh
bun run dev
```

Changing Rust source rebuilds the extension and restarts the host process. Native code is never hot-replaced in a running process. A UI-only change reuses the verified native artifact. If compilation fails, Crumb removes the stale loadable artifact and does not start the application with the capability silently missing.

Force a clean extension rebuild after changing the toolchain, linker configuration, or dependencies:

```sh
bun run rebuild:extensions
```

Then build on the target operating system:

```sh
# Apple Silicon macOS
bun run build --target=macos-arm64

# Linux x64
bun run build --target=linux-x64
```

For a separately registered application, add `--example=<name>` to `dev`, `rebuild:extensions`, and `build`. Release compilation embeds every declared extension in the standalone executable and reports any non-system dynamic dependency introduced by the crate. Test the executable after copying it by itself into an otherwise empty directory, and exercise an operation that actually calls each extension; opening the window alone does not prove that an embedded addon works.

## Study the complete activity-monitor example

The minimal `answer()` crate above makes the mechanics visible without dependencies. For a realistic application, use [`examples/activity-monitor/`](../examples/activity-monitor/) as the worked reference:

```text
examples/activity-monitor/
├── app.config.ts
├── native/system-monitor/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   └── src/lib.rs
├── src/
│   ├── host/handlers.ts
│   ├── shared/{contracts,validators}.ts
│   └── ui/{index.html,styles.css,app.ts,client.ts,state.ts}
└── test/
```

Launch it on Linux x64 from a native Wayland session:

```sh
bun run dev --example=activity-monitor
```

The first run validates the `nativeExtensions` declaration and compiles the Rust crate. The crate uses `sysinfo` for system data and `napi-rs` `AsyncTask`s for Node-API promises, so process enumeration runs on Bun's worker pool instead of blocking the window event loop. It returns one structured system snapshot, one whole-process array, and optional per-process detail. A PID that exits during inspection returns `null`, and fields the platform cannot supply are represented as unavailable rather than zero.

The host module imports `app:ext/system-monitor`; the browser does not. Host handlers validate and normalize every native result before `systemSnapshot`, `processList`, or `processDetails` crosses the existing Crumb bridge. Refresh requests cannot overlap, auto-refresh is opt-in at five seconds, and the registered shutdown handler tells in-flight native tasks to stop. The UI exposes no process-control operation.

Run its application and Rust tests directly when changing the example:

```sh
bun test examples/activity-monitor
cargo test --manifest-path examples/activity-monitor/native/system-monitor/Cargo.toml --locked
```

Build the standalone Linux application with:

```sh
bun run build --example=activity-monitor --target=linux-x64
./dist/activity-monitor-linux-x64
```

The current metric record is explicit about platform behavior:

| Metric | Linux x64 | macOS arm64 |
| --- | --- | --- |
| Overall CPU, total/used memory, process count | Supplied and verified | Supplied and verified |
| 1/5/15-minute load average | Supplied and verified | Supplied and verified |
| Per-process CPU, memory, state, and parent PID | Supplied and verified; parent PID can be unavailable | Supplied and verified; parent PID can be unavailable |
| Executable path and process timing | Supplied when the OS permits inspection; otherwise unavailable | Supplied when the OS permits inspection; otherwise unavailable |

Optional native values become `null` in the shared application contract and the UI prints **Unavailable**. Zero remains a real measured value.

The addon and the executable-only relocation journey are verified on Linux x64 and macOS arm64. [Release verification](./verification.md) holds the measured compile times, dependency listings, and relocation results for both platforms; they are recorded there rather than here so this guide does not carry figures that date. The dependency-free [`native-probe`](../src/app/native/probe/) remains the smallest cross-platform verification of Crumb's extension mechanism.

## Study the crumbbrot example

The activity monitor shows an extension that *fetches* data. [`examples/crumbbrot/`](../examples/crumbbrot/) shows one that *computes* it — an interactive Mandelbrot and Julia explorer whose `fractal-renderer` crate is the slowest part of the application by design:

```text
examples/crumbbrot/
├── app.config.ts
├── native/fractal-renderer/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   └── src/lib.rs
└── src/
    ├── host/{handlers,pixels}.ts
    ├── shared/{contracts,validators}.ts
    └── ui/{index.html,styles.css,app.ts,client.ts,state.ts}
```

```sh
bun run dev --example=crumbbrot
```

It is worth reading for three things the minimal `answer()` crate cannot show.

**Validation before expensive work.** `renderFractal` validates dimensions, viewport, iteration limit, and Julia parameter in TypeScript, and the crate validates them a second time before allocating. An operation that commits the host to seconds of computation should bound its input on both sides; the page cannot be trusted to have done it.

**Long native work off the event loop, and cancellable.** The crate returns a `napi` `AsyncTask`, so rendering runs on Bun's worker pool rather than the window's event-loop path. Inside the task, rows are handed to a pool of scoped threads sized by `std::thread::available_parallelism`, which is what makes a full-resolution deep zoom interactive rather than a multi-second freeze. A process-wide cancellation generation is re-checked before each row, so the shutdown handler registered in host code stops in-flight renders instead of blocking the close.

**A result too large for the bridge to carry naturally.** The bridge is JSON text, so the RGBA buffer is base64-encoded by the host and decoded into an `ImageData` by the page. See "Move large or binary results" in the main guide for the cost, and [`src/host/pixels.ts`](../examples/crumbbrot/src/host/pixels.ts) for the length check that rejects a mis-sized buffer before it reaches the canvas.

The page side is equally instructive: `RenderCoordinator` in [`src/ui/state.ts`](../examples/crumbbrot/src/ui/state.ts) coalesces the render requests produced by dragging and zooming, and discards superseded frames, which is the pattern described under "Keep the interface responsive" in the main guide.

Run its application and Rust tests when changing the example:

```sh
bun test examples/crumbbrot
cargo test --manifest-path examples/crumbbrot/native/fractal-renderer/Cargo.toml --locked
```

The Rust tests include a check that the multi-threaded render is byte-identical to a serial reference for both fractal modes. Any extension that parallelizes work should carry an equivalent test: threading bugs show up as intermittently wrong output, not as failures.

## Treat native code as trusted process code

A Rust extension has the Bun process's full operating-system permissions. It can read and write files, use the network, crash the process, or terminate it. `bun run verify:readonly` scans TypeScript only and makes no claim about Rust, so review native code separately.

Do not run long or blocking native work on the window's event-loop path. If an extension owns threads, handles, or other resources, register cleanup from host code:

```ts
import { registerShutdownHandler } from "../../kit/host/shutdown";

registerShutdownHandler("answer extension", async () => {
  // Signal native work to stop and await its bounded cleanup here.
});
```

Shutdown handlers run once in registration order. Failures are reported without skipping later handlers, and the complete shutdown phase is bounded to three seconds so a hanging extension cannot make the window unclosable.
