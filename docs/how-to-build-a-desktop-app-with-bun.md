# How to build a desktop app with Bun

Crumb turns a local web interface into a native desktop application. You write HTML, CSS, and browser TypeScript for the interface, and use Bun for any trusted host-side work. Crumb supplies the native window, embeds the interface, and connects both sides through a small validated message bridge.

The result is not a hosted website and does not start a local web server. In development and in the finished executable, the interface runs inside the operating system's WebView. A release contains the Bun runtime, host code, and application-owned interface in one executable.

Crumb currently targets:

- Apple Silicon on macOS 13 or newer
- Linux x64 on Ubuntu 26.04 with GTK 3, WebKitGTK 4.1, and a native Wayland session

Windows, X11, and XWayland are not supported.

## 1. Install and run the starter

Install [Bun](https://bun.com/) 1.4 or newer, clone Crumb, and install its pinned dependencies:

```sh
git clone https://github.com/soyrochus/crumb.git my-desktop-app
cd my-desktop-app
bun install
bun run dev
```

On macOS, the system WKWebView is sufficient for ordinary development. Linux also needs the packages listed in [Build and runtime support](./build-and-runtime.md#linux).

The TypeScript-only starter needs no Rust toolchain on macOS. If you add a Rust native extension, install stable Rust with [rustup](https://rustup.rs/) and install Apple Command Line Tools with `xcode-select --install`. Linux uses Rust for Crumb's native Wayland binding as well as for application extensions; [rustup](https://rustup.rs/) is the recommended installer there too.

`bun run dev` opens the starter in a native window. It watches the application and Crumb kit sources; after a save, it rebuilds the interface and restarts the application. WebView developer tools are available in this development mode only.

Use a one-shot launch when a watcher is inconvenient:

```sh
bun run dev --no-watch
```

## 2. Know which files are yours

Build the application in `src/app/`:

```text
src/app/
├── app.config.ts          Window, UI entries, policy, and declared operations
├── host/handlers.ts       Trusted Bun-side work
├── shared/contracts.ts    Input and output types shared across the bridge
├── shared/validators.ts   Runtime checks for messages from the WebView
└── ui/
    ├── index.html         Document structure
    ├── styles.css         Interface styles
    └── app.ts             Browser behavior
```

The reusable runtime and bridge live in `src/kit/`. A normal application should not need to change them. The repository-level `app.config.ts` is an application registry; its default entry already points to `src/app/app.config.ts`.

The browser side can use normal DOM and Web APIs that the operating-system WebView supports. It cannot import Bun APIs or Node APIs. Put filesystem access, native integrations, and other privileged work in a host handler instead.

## 3. Build the web interface

Start as you would with a small client-side web app. For example, replace `src/app/ui/index.html` with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"
  >
  <title>Hello desktop</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main>
    <h1>Hello desktop</h1>
    <label for="name">Your name</label>
    <input id="name" autocomplete="name">
    <button id="greet" type="button">Greet me</button>
    <p id="result" aria-live="polite"></p>
  </main>
  <script type="module" src="./app.ts"></script>
</body>
</html>
```

Keep the stylesheet link and script tag in this form. Crumb's UI build replaces them with inline CSS and bundled JavaScript so the finished application does not need adjacent asset files.

Add any layout and visual design to `src/app/ui/styles.css`. No frontend framework is required. If you introduce one, it must produce browser code that Bun can bundle from the configured `uiScript` entry, and it must not depend on a server at runtime.

## 4. Declare a typed host operation

Code inside a WebView is untrusted at the host boundary, even when it was bundled with the application. A Crumb operation therefore has four parts:

1. a shared TypeScript contract;
2. a runtime validator;
3. a Bun host handler;
4. an entry in the application's operation table.

This example sends a name to Bun and returns a greeting.

First, define the bridge types in `src/app/shared/contracts.ts`:

```ts
export type AppOperations = {
  greet: {
    input: { name: string };
    output: { message: string };
  };
};
```

Then validate the value received from the WebView in `src/app/shared/validators.ts`:

```ts
import {
  expectOnlyKeys,
  ValidationError,
} from "../../kit/shared/validation";

export const validators = {
  greet(raw: unknown): { name: string } {
    const input = expectOnlyKeys(raw, ["name"]);
    if (typeof input.name !== "string") {
      throw new ValidationError("Expected name to be a string");
    }

    const name = input.name.trim();
    if (name.length === 0 || name.length > 80) {
      throw new ValidationError("Enter a name between 1 and 80 characters");
    }
    return { name };
  },
};
```

Validation is runtime security, not just a TypeScript convenience. The host does not run the handler unless its validator accepts the input. Prefer small explicit validators, reject unexpected keys, and put sensible bounds on strings, arrays, and file sizes.

Implement the trusted work in `src/app/host/handlers.ts`:

```ts
export const handlers = {
  greet({ name }: { name: string }): { message: string } {
    return { message: `Hello, ${name}, from Bun ${Bun.version}.` };
  },
};
```

Handlers may be synchronous or asynchronous. They run in the Bun host, so this is where to use Bun APIs, read or write files, call an explicitly allowed service, or integrate with the operating system. Return serializable data; do not pass functions, DOM objects, or other process-local values across the bridge.

Finally, register the operation in `src/app/app.config.ts`:

```ts
import type { ApplicationConfig } from "../kit/shared/config";
import { operation } from "../kit/shared/transport";
import { handlers } from "./host/handlers";
import { validators } from "./shared/validators";

export const starter: ApplicationConfig = {
  name: "Hello desktop",

  window: {
    title: "Hello desktop",
    width: 720,
    height: 520,
    minWidth: 420,
    minHeight: 320,
    resizable: true,
  },

  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  entries: {
    uiScript: "src/app/ui/app.ts",
    uiDocument: "src/app/ui/index.html",
    uiStyles: "src/app/ui/styles.css",
  },

  operations: {
    greet: operation(validators.greet, handlers.greet),
  },
};
```

Only names in `operations` are reachable from the page. Crumb has no fallback filesystem API, shell binding, or generic evaluation route.

## 5. Call Bun from the page

Connect the interface to the declared operation in `src/app/ui/app.ts`:

```ts
import { invoke } from "../../kit/ui/bridge";
import type { AppOperations } from "../shared/contracts";

const name = document.getElementById("name") as HTMLInputElement;
const button = document.getElementById("greet") as HTMLButtonElement;
const result = document.getElementById("result") as HTMLParagraphElement;

button.addEventListener("click", () => {
  button.disabled = true;
  result.textContent = "Working…";

  void invoke<AppOperations, "greet">("greet", { name: name.value })
    .then(({ message }) => {
      result.textContent = message;
    })
    .catch((error: unknown) => {
      result.textContent = error instanceof Error
        ? error.message
        : "The host call failed.";
    })
    .finally(() => {
      button.disabled = false;
    });
});
```

The `AppOperations` map keeps the operation name, input, and output typed in browser code. The validator remains necessary because types do not exist at runtime and page messages can be malformed or hostile.

Save the file while `bun run dev` is active. Crumb reports the changed source, rebuilds the embedded document, and restarts the native window with the new application.

## 6. Keep the app local and secure

Crumb's default Content Security Policy blocks network connections, remote scripts, forms, frames, object embedding, and unintended navigation. Keep that policy unless the application genuinely needs a wider capability.

The policy appears in two places for two stages of the build:

- `src/app/ui/index.html` uses `'self'` for its source stylesheet and script.
- `src/app/app.config.ts` uses `'unsafe-inline'` because the production build embeds both into the final HTML document.

If you intentionally change the policy, update both declarations consistently. Treat `connect-src`, script execution, and navigation as security boundaries rather than as fixes for a failing request.

For local files, send an explicit, narrowly shaped request to a host operation. Validate paths with `normalizeAbsolutePath()` from `src/kit/shared/validation.ts`, constrain reads and writes, and return safe domain data. Do not expose a generic “run command,” “read anything,” or `eval` operation to the page.

Application state is in memory unless your own host handlers persist it. If the app writes settings or user data, make the destination and behavior explicit and test failure cases such as missing files and denied permissions.

## 7. Test before building

Run the standard local checks:

```sh
bun test
bun run typecheck
```

Tests use Bun's test runner. Add application tests under `test/` or beside a separately registered example, and test validators and handlers without going through the WebView whenever possible.

You can also inspect the generated single-document interface:

```sh
bun run build:ui
```

This writes `dist/ui.html`. It is a build artifact for inspection, not a page that the release loads from disk.

## 8. Add a Rust native extension (optional)

Use a Rust extension when trusted host work needs native performance, an existing native library, or operating-system access that is impractical in TypeScript. Extensions run inside the Bun host process and are reached only from trusted host code. The WebView still calls a declared, validated operation; it never imports or selects native modules itself.

### Install Rust and the platform linker

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

### Create a Node-API `cdylib`

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

### Declare and call the extension

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

### Develop, rebuild, and release

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

### Study the complete activity-monitor example

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

The Linux x64 addon introduces no non-system dynamic dependency; its observed direct ELF dependencies are the system loader, libc, and libgcc. On the implementation host, the first optimized extension compile took 8.2 seconds, a verified warm-cache lookup took 2.2 milliseconds, and the subsequent selected-application build took 0.18 seconds. These measurements vary by machine.

The current metric record is explicit about verification status:

| Metric | Linux x64 | macOS arm64 |
| --- | --- | --- |
| Overall CPU, total/used memory, process count | Supplied and verified | Implemented through `sysinfo`; verification deferred |
| 1/5/15-minute load average | Supplied and verified | Implemented through `sysinfo`; verification deferred |
| Per-process CPU, memory, state, and parent PID | Supplied and verified; parent PID can be unavailable | Implemented through `sysinfo`; verification deferred |
| Executable path and process timing | Supplied when the OS permits inspection; otherwise unavailable | Implemented as optional values; verification deferred |

Optional native values become `null` in the shared application contract and the UI prints **Unavailable**. Zero remains a real measured value.

The crate is structured for both supported operating systems, but the activity-monitor-specific macOS arm64 artifact, relocation, platform-difference, and timing checks are currently deferred. The existing dependency-free `native-probe` remains the cross-platform verification of Crumb's extension mechanism.

### Treat native code as trusted process code

A Rust extension has the Bun process's full operating-system permissions. It can read and write files, use the network, crash the process, or terminate it. `bun run verify:readonly` scans TypeScript only and makes no claim about Rust, so review native code separately.

Do not run long or blocking native work on the window's event-loop path. If an extension owns threads, handles, or other resources, register cleanup from host code:

```ts
import { registerShutdownHandler } from "../../kit/host/shutdown";

registerShutdownHandler("answer extension", async () => {
  // Signal native work to stop and await its bounded cleanup here.
});
```

Shutdown handlers run once in registration order. Failures are reported without skipping later handlers, and the complete shutdown phase is bounded to three seconds so a hanging extension cannot make the window unclosable.

## 9. Build the standalone executable

Build releases on the operating system they target. Cross-platform release builds are intentionally rejected until the native binding combination has been verified.

On Apple Silicon macOS:

```sh
bun run build --target=macos-arm64
./dist/starter-macos-arm64
```

On Linux x64 under Wayland:

```sh
bun run build --target=linux-x64
./dist/starter-linux-x64
```

Choose a product-oriented output name with `--output`:

```sh
bun run build --target=macos-arm64 --output=hello-desktop
./dist/hello-desktop-macos-arm64
```

The output is a raw executable, not an installer or macOS `.app` bundle. It contains the Bun runtime, host code, bundled interface, target native binding, and every Rust extension declared by the selected application. It needs no adjacent application files, Bun installation, Node.js installation, Rust toolchain, source checkout, or local server at runtime. The operating system's native WebView libraries and any non-system dynamic libraries reported by the extension inspection remain platform dependencies.

Release builds always disable WebView developer tools, regardless of application configuration.

## 10. Add another application without replacing the starter

For a second application, copy the `src/app/` shape to a new directory, give it an `ApplicationConfig`, and register it in the repository-level `app.config.ts`:

```ts
import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";
import { notes } from "./examples/notes/app.config";

export const registry: ApplicationRegistry = {
  default: "starter",
  applications: {
    starter,
    notes,
  },
};
```

Select it by registry key during development or release:

```sh
bun run dev --example=notes
bun run build --example=notes --target=macos-arm64
```

The flag is called `--example` because the repository ships its worked applications under `examples/`, but registered applications are first-class build targets. An unknown name fails immediately and lists the available entries.

## What happens during a release build

Crumb owns all build stages:

1. Crumb validates every declared native extension, runs `cargo build --release --locked` for missing or stale crates, and verifies each produced artifact.
2. `Bun.build()` bundles the browser TypeScript, then Crumb inserts the JavaScript and CSS into one HTML document.
3. `Bun.build({ compile: ... })` compiles the host, shared code, embedded document, native binding, declared extensions, and Bun runtime into the target executable.

At runtime the native shell loads that embedded document directly. There is no frontend deployment, localhost port, background server, or source-tree lookup. That is the central constraint when choosing what to build with Crumb: make the interface a client-side web app, and place privileged or machine-local work behind deliberate validated host operations.

For platform dependencies, artifact inspection, and isolated-runtime checks, continue with [Build and runtime support](./build-and-runtime.md) and [Release verification](./verification.md).
