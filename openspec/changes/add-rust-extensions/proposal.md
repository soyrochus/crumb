## Why

Some capabilities a desktop application needs — process and system inspection, CPU-bound work, existing native libraries — are impractical or slow in TypeScript. Crumb has no way for an application to add them, so an author's only options are to do without or to build and package a native component by hand, outside the template's workflow.

The machinery is mostly already here. `scripts/build-native.ts` downloads, checksum-verifies, patches, and `cargo build --release --locked`s a Rust crate into a Node-API `.node`, caches it under `.build/`, and `scripts/build.ts` embeds it through the `app:native` virtual module using a statically analyzable literal that Bun can follow. That pipeline works on both supported targets today. What it does not do is generalize: it serves exactly one hardcoded, template-owned crate — the patched WebView binding — and knows nothing about applications.

This change turns that one-crate pipeline into an application-declarable one. It is scope **Stage 1** of `specs/native-extensions-for-crumb.md`: prove the path end to end with a minimal extension. The Activity Monitor example, reusable prebuilt extensions, and other native backends are later changes.

## What Changes

- **`ApplicationConfig` gains an optional `nativeExtensions` field** — a record of logical name → crate directory, relative to the repository root. Absent or empty means the application is TypeScript-only and nothing about its workflow changes.
- **Application-owned crates live with their application**: `src/app/native/<name>/` and `examples/<app>/native/<name>/`. Top-level `native/` stays what it is — the template's own pinned Wayland patch — so crate ownership follows the boundary `extract-crumb-kit` established.
- **A generalized native builder.** `scripts/build-native.ts` is split: the pinned-upstream WebView logic stays as-is, and a new builder compiles an application-declared crate for a selected target, verifies the produced addon, and caches it under a key that distinguishes extension, target, and architecture.
- **Extensions are imported through `app:ext/<name>`** — a virtual module in the same family as `app:ui` and `app:native`. **Not** `crumb:native/...` as the design draft illustrates: `template-identity` forbids branding identifiers exposed to application code, and `app:native` is already taken by the WebView binding.
- **The build embeds every declared extension** for the selected target, generating the concrete `.node` reference from the declaration so Bun's standalone embedding can follow it.
- **The development loop treats Rust as a watched source.** Changing a declared crate rebuilds it and restarts the host; a failed rebuild never leaves a stale addon loaded and never falls back to an artifact for another target.
- **The host gains a shutdown hook.** `src/kit/host/main.ts` currently ends with `process.exit(0)` on window close, which runs no cleanup. Native code with threads or open handles needs a chance to stop, so close becomes: stop accepting messages, run registered shutdown handlers, then exit.
- **Release verification covers extensions**: the relocated executable must exercise each declared extension, not merely open a window, and artifact inspection must report any dynamic dependency an extension introduces.
- **Documentation** states plainly that macOS applications declaring a Rust extension need a Rust toolchain — today's README promises macOS needs none, which stays true only for TypeScript-only applications.

**Not in scope:** the Activity Monitor example (Stage 2), reusable or prebuilt extensions (Stage 4), other native backends or source languages, Bun FFI, WebAssembly, runtime-loaded plugins, and cross-compilation. `specs/native-extensions-for-crumb.md` §4 fences these deliberately and this change adopts that fence unchanged.

## Capabilities

### New Capabilities

- `native-extensions`: How an application declares a native capability, how the toolchain builds and embeds it, what the application-facing import contract is, and what the WebView is still not allowed to do because of it.

### Modified Capabilities

- `standalone-distribution`: "Single application-owned runtime file" must name declared extension addons among the embedded content, not just the WebView binding. "Clean-machine acceptance" must exercise each declared extension in the relocated executable.
- `desktop-shell`: "Clean lifecycle" must require that shutdown work actually runs on window close. The current implementation exits the process immediately, which is adequate for pure TypeScript and not adequate once native threads and handles exist.
- `developer-workflow`: "Fast edit-run loop" must cover native source among watched inputs, and state that a failed native rebuild never leaves a stale or foreign-target addon loaded.

`template-identity` needs no change — its naming rule is what forces `app:ext/<name>` over `crumb:native/<name>`. This change complies with it rather than altering it.

## Impact

- **Code**: `src/kit/shared/config.ts` (declaration shape), `src/kit/host/main.ts` (shutdown hook), `scripts/build-native.ts` (split), a new extension builder, `scripts/build.ts` and `scripts/runner.ts` (resolve, build, embed, and expose `app:ext/<name>`), `scripts/dev.ts` (watch crates).
- **Tests**: new kit tests for declaration validation, name uniqueness, cache-key distinctness across targets, and the WebView's continued inability to reach a native module. Current baseline is **75 pass, 160 expectations** and must not fall.
- **Build cost**: this is the main practical risk. CI was made tag-only because compiling *one* Rust addon per target is already slow; N declared extensions multiply it. The caching and staleness model is what keeps this usable, so it is treated as a requirement rather than an optimization.
- **Security surface**: a native extension is trusted host code in the same process, and `verify:readonly` cannot see into it. An application that adopts a read-only policy *and* declares an extension has a boundary the static check does not cover — this must be stated where the check is documented, or the check becomes misleading.
- **Platform promise**: macOS has never compiled Rust in this repository — its WebView addon arrives prebuilt from `node_modules`. Automatic Cargo invocation on macOS arm64 is the genuinely unproven half of this change and should be sequenced first.
