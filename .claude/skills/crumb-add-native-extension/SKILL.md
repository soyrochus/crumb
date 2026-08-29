---
name: crumb-add-native-extension
description: Use when adding, changing, or reviewing a Rust native extension in a Crumb application — anything the host needs compiled code for, and any work on a crate under an application's native/ directory.
---

# Add a Rust native extension

A native extension is an application-owned Rust crate the host imports as
`app:ext/<name>`. Crumb validates the declaration, builds the crate, verifies
the artifact, and embeds it in the standalone executable. Three things are easy
to get almost right: the crate shape, the declaration, and the trust boundary.

## The crate

Put it under the application's own tree — `src/app/native/<name>/` for the
starter. Three files, and each one is load-bearing.

**`Cargo.toml`** — must declare `package.name` and a `cdylib`. Crumb reads this
manifest and refuses the declaration without it.

```toml
[package]
name = "crumb-answer"
version = "0.1.0"
edition = "2024"

[lib]
name = "crumb_answer"
crate-type = ["cdylib"]

[profile.release]
strip = "symbols"
```

**`src/lib.rs`** — must export a Node-API module initializer. Without
`napi_register_module_v1`, the crate compiles, the artifact is produced, and Bun
cannot import it:

```rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_register_module_v1(env: napi_env, exports: napi_value) -> napi_value {
    // Attach exports here.
    exports
}
```

See `src/app/native/probe/src/lib.rs` for a complete minimal one, declaring the
Node-API symbols it uses directly rather than taking a dependency.

**`build.rs`** — macOS only, and required there. Node-API symbols are supplied
by Bun at load time, so the link must be allowed to leave them undefined:

```rust
fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-undefined");
        println!("cargo:rustc-cdylib-link-arg=-Wl,dynamic_lookup");
    }
}
```

**Commit `Cargo.lock`.** Crumb builds with `cargo build --release --locked`,
which fails rather than resolving new dependency versions. An uncommitted or
stale lockfile is a build failure, not a warning.

## The declaration

In the application's config, `nativeExtensions` maps a stable logical import
name to the crate's source directory, relative to the repository root:

```ts
nativeExtensions: { answer: "src/app/native/answer" },
```

- Logical names start with a lowercase letter and contain only lowercase
  letters, digits, `-`, or `_`, and must be unique within the application.
- **Declare source only.** No `.node`, `.so`, `.dylib`, or `.dll`; no platform
  or architecture suffix; no build-output or target path. Crumb rejects these
  outright — artifact naming and placement are the template's, not the
  application's.
- The directory must exist, contain `Cargo.toml`, and stay inside the
  repository.

## Calling it

Import the logical module from **trusted host code only**:

```ts
import answerExtension from "app:ext/answer";
```

The WebView never reaches native code directly. It calls a declared, validated
operation, and that operation's handler calls the extension — see the
`crumb-add-operation` skill for the five parts that involves. Never expose a
native module name, an artifact path, or an arbitrary native call to the page.

Treat the extension's exports as untyped: check that what you imported is a
function and that what it returned has the shape you expect, and fail with a
clear error rather than propagating a wrong value.

## Keep configuration importable

Repository tools and tests import the application registry before Crumb's
runner has installed the `app:ext/*` resolver. If `app.config.ts` statically
imports a host module that statically imports an extension, merely inspecting
the registry fails. Pair the operation with a small lazy wrapper in the config,
and keep the logical native import in trusted host code:

```ts
const handlers = {
  async nativeAnswer(input: Record<string, never>) {
    return (await import("./host/handlers")).handlers.nativeAnswer(input);
  },
};

// ...
operations: {
  nativeAnswer: operation(validators.nativeAnswer, handlers.nativeAnswer),
},
```

For an application under `examples/<name>/`, adapt the import to its actual
host path, normally `./src/host/handlers`. This delays loading native code until
a validated operation is dispatched; it does not move the import into the
WebView or make the native module selectable.

## Building

`bun run dev` validates the declaration, builds a missing or stale crate, and
restarts the host when Rust source changes — native code is never hot-replaced
in a running process. If compilation fails, Crumb removes the stale artifact
rather than starting with the capability silently missing.

`bun run rebuild:extensions` is a forced clean rebuild, not a routine step:
reach for it after changing the toolchain, the linker configuration, or
dependencies, or when a cached artifact is suspect. Add `--example=<name>` for a
registered application.

Release builds run on the operating system they target and embed every declared
extension. Test the executable by copying it alone into an empty directory and
exercising an operation that actually calls the extension — opening the window
proves nothing about an embedded addon.

## The trust boundary

A Rust extension runs with the Bun host process's full operating-system
permissions. It can read and write any file the user can, use the network,
crash the process, or terminate it.

`bun run verify:readonly` scans TypeScript only and **makes no claim about
Rust**. A capability boundary an application enforces in TypeScript is not
enforced in a crate; review native code separately and deliberately.

Two runtime rules:

- Do not run long or blocking work on the window's event-loop path.
- If the extension owns threads, handles, or other resources, register cleanup
  from host code with `registerShutdownHandler()` from
  `src/kit/host/shutdown.ts`. Handlers run once, in registration order, and the
  whole shutdown phase is bounded to three seconds, so an extension that ignores
  this can outlive the window it belonged to.

## Beyond the ceremony

Section 8 of
[`docs/how-to-build-a-desktop-app-with-bun.md`](../../docs/how-to-build-a-desktop-app-with-bun.md)
covers toolchain setup, the complete `activity-monitor` example, and release
inspection; the `native-extensions` requirements under
[`openspec/specs/`](https://github.com/soyrochus/crumb/tree/main/openspec/specs/) are normative. Where this skill
disagrees with either, they govern and this skill is what gets corrected.
