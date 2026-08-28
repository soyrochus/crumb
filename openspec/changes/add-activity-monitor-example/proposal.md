## Why

`add-rust-extensions` proves the native path with a throwaway probe crate: one function, no UI, no system access. That is the right first proof — it makes a build failure unambiguous — but it demonstrates nothing an application author would recognise as useful, and it exercises none of the concerns that decide whether the extension model actually works: structured return types, repeated calls, platform differences, non-blocking sampling, and real error cases.

Crumb also has exactly one worked example. `file-explorer` shows a substantial application built entirely in TypeScript. Nothing shows an application where a capability genuinely belongs in native code, which is the case the extension mechanism exists to serve.

This is Stage 2 of `specs/native-extensions-for-crumb.md`.

## What Changes

- **A second worked example, `examples/activity-monitor/`**, a sibling of `examples/file-explorer/` with the identical shape: its own `app.config.ts`, its own `src/`, its own `test/`, and now its own `native/` crate. It is registered in `app.config.ts` alongside the others and runs with `bun run dev --example=activity-monitor`.
- **A Rust extension providing system information** — a system snapshot, a process list, and per-process detail — declared through `nativeExtensions` and reached from TypeScript through `app:ext/<name>`.
- **A web UI showing live system state**: overall CPU, total and used memory, process count, and a sortable process table with PID, name, CPU, memory, and state. Ordinary HTML, CSS, and TypeScript — the point is that the UI is unremarkable and only the capability underneath it is native.
- **Declared operations wrapping the native calls**, each validated before native code sees any input, demonstrating that a native extension reaches the page only through the same narrow boundary every other operation uses.
- **Non-blocking sampling.** Process enumeration is the kind of work that freezes a window if done carelessly, so this example is where the asynchronous path stops being theoretical.
- **A bounded refresh with real shutdown behaviour**, exercising the shutdown hook `add-rust-extensions` adds — sampling in flight when the window closes must stop rather than be abandoned.
- **Documentation** presenting the two examples for what they are: `file-explorer` as the TypeScript-only worked example, `activity-monitor` as the native-extension worked example.

**Not in scope:** killing, suspending, renicing, or otherwise acting on processes — this is an inspector, and adding process control would give the example a destructive capability it does not need to make its point. Also out of scope: Windows, disk and network panels beyond what a first version needs, historical graphing, and any claim that the metrics match a platform's own tooling exactly.

## Capabilities

### New Capabilities

- `activity-monitor`: What the example application does — the system information it presents, how it refreshes, how it behaves when a platform cannot supply a metric, and what it deliberately does not do to a process. A `file-explorer` sibling: an example-owned capability, not a template promise.

### Modified Capabilities

None. `native-extensions` already requires everything this example relies on — declaration, toolchain-owned build, stable import, embedding, non-blocking work, and the unchanged WebView boundary. This change is the first real exercise of those requirements rather than an extension of them. If building it forces a requirement to change, that is a finding worth surfacing as an amendment rather than something to plan for now.

## Impact

- **Depends on `add-rust-extensions`.** This change cannot start until that one is applied and its probe crate has proven the path on both targets. Sequencing it earlier would mean debugging the mechanism and the example at the same time.
- **Code**: new `examples/activity-monitor/` with `app.config.ts`, `src/host/`, `src/shared/`, `src/ui/`, `native/system-monitor/`, and `test/`; one line added to the registry in `app.config.ts`.
- **Dependencies**: a Rust crate such as `sysinfo` for cross-platform collection. It must not introduce a dynamic library dependency, raise the minimum macOS version, or raise the glibc baseline — `standalone-distribution` requires any such change to be reported and recorded, and this example should not be the thing that quietly erodes the single-executable promise.
- **Build and CI cost**: this is the repository's first application that needs Cargo. Linux x64 is implemented and measured first; macOS arm64 artifact, relocation, and build-cost checks are explicitly deferred. That cost lands in the release workflow and is another argument for the deferred prebuilt-addon work.
- **Platform differences are the real work.** Process state, load average, and per-process CPU accounting differ between macOS and Linux. The example must present what a platform can supply and say so plainly where it cannot, rather than inventing a number.
- **Tests**: example-owned tests for the TypeScript layer — validation, sorting, formatting, and rendering against fixture data. Native collection itself is verified in Rust and through the standalone acceptance journey, not by asserting live system values in the suite.
