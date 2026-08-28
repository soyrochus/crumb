## 1. Bounded shutdown in the host

Stands alone and is verifiable alone, with no extension involved. Doing it first means the native work has somewhere to hook.

- [x] 1.1 Add a shutdown registry to the kit: handlers registered by the application or by an extension, run once, in registration order
- [x] 1.2 Replace `process.exit(0)` in `src/kit/host/main.ts` with: stop accepting messages, run registered handlers, then exit
- [x] 1.3 Bound the shutdown phase with a timeout so a hanging handler cannot make the window unclosable; report the incomplete handler and exit anyway
- [x] 1.4 Add kit tests: handlers run in order, run exactly once, a throwing handler does not prevent the others or the exit, and a hanging handler is bounded and reported
- [x] 1.5 Confirm both existing applications still close cleanly — `bun run dev` and `bun run dev --example=file-explorer`, opened and closed
- [x] 1.6 `bun test` — no assertion lost against the 75 pass / 160 expectations baseline

## 2. Declaration shape and validation

No native build yet: prove the declaration is understood and its failures are diagnosed before anything compiles.

- [x] 2.1 Add an optional `nativeExtensions` field to `ApplicationConfig`: logical name → source directory, relative to the repository root
- [x] 2.2 Confirm the field is genuinely optional — both current applications typecheck and build with it absent
- [x] 2.3 Validate declarations: unique logical names, a source directory that exists, and a readable crate manifest
- [x] 2.4 Reject a declaration containing a target-specific artifact path, filename, or platform suffix — the toolchain derives those and accepting them would let the "intent only" requirement rot
- [x] 2.5 Diagnostics name the offending application and logical name, and no build starts
- [x] 2.6 Add kit tests for each rejection: missing directory, invalid manifest, duplicate name, artifact path present

## 3. Build one crate on macOS arm64

The unproven half. Sequenced before Linux so a toolchain surprise invalidates the least work.

- [x] 3.1 Write a throwaway minimal crate under `src/app/native/probe/` exporting one synchronous function
- [x] 3.2 Write the application-crate builder — separate from `scripts/build-native.ts`, whose pinned-upstream WebView logic stays untouched
- [x] 3.3 Invoke Cargo for the crate with an explicit `CARGO_TARGET_DIR` under `.build/`, and verify the expected artifact was produced rather than assuming it
- [x] 3.4 Record what a clean macOS machine actually needs — Rust toolchain, linker, whether Xcode command line tools are required — this is the finding that qualifies the README's macOS promise
- [x] 3.5 Extend the virtual-module plugin with `app:ext/<name>`, in both `scripts/build.ts` and `scripts/runner.ts`, since the plugin must be registered in whichever process imports the host
- [x] 3.6 `bun run dev` loads the probe extension and a host operation calls it successfully
- [x] 3.7 Measure and record a cold and a warm build of the probe crate — the input to whether this is pleasant at N extensions

## 4. Build the same crate on Linux x64

- [x] 4.1 Build the probe crate for `linux-x64` through the same builder
- [x] 4.2 Confirm `scripts/build-native.ts` still builds the pinned WebView addon unchanged, and that the two paths do not share cache state
- [x] 4.3 `bun run dev` on Linux loads the probe extension and calls it
- [x] 4.4 Confirm a TypeScript-only application on Linux still needs no extension build

## 5. Embedding and relocation

- [x] 5.1 Generate a statically analyzable `require(<literal>)` reference per declared extension for the selected target, the way the WebView binding already is
- [x] 5.2 `bun run build` embeds every declared extension
- [x] 5.3 Copy the executable alone to an empty directory and confirm the extension-backed operation returns a real result — launching the window is not sufficient evidence
- [x] 5.4 Artifact inspection reports any dynamic dependency the extension introduces; confirm the probe adds none
- [x] 5.5 Confirm no build-machine path survives in the executable
- [x] 5.6 Confirm a TypeScript-only application still produces its normal executable with nothing extension-related embedded

## 6. Watching, staleness, and cache correctness

The requirement that decides whether this is usable rather than merely possible.

- [x] 6.1 Watch declared crate sources; changing one rebuilds it and restarts the host, never hot-replacing native code in a running process
- [x] 6.2 Confirm a UI-only change does **not** trigger a native rebuild
- [x] 6.3 Cache key distinguishes extension, target, and architecture
- [x] 6.4 A failed native rebuild does not leave the previous artifact loaded as though current, and does not start the application with the capability silently missing
- [x] 6.5 An artifact that cannot be established as belonging to this extension and target is rejected, not loaded — test with a deliberately mismatched artifact
- [x] 6.6 Add an explicit clean/rebuild command for diagnostics
- [x] 6.7 Add kit tests for cache-key distinctness and staleness detection

## 7. Documentation

- [x] 7.1 Document declaring an extension, where crates live, and the `app:ext/<name>` import
- [x] 7.2 Qualify the README's macOS promise: no Rust toolchain is needed for TypeScript-only applications; declaring an extension requires what task 3.4 recorded
- [x] 7.3 State where `verify:readonly` is documented that it scans host-language source only and makes no claim about native code, so an application with both a read-only policy and an extension must review that code separately
- [x] 7.4 State that a native extension is trusted host code with the process's full permissions, and can crash the application
- [x] 7.5 Document the shutdown hook and its bound
- [x] 7.6 Record the measured build costs from 3.7 so the cost of adding an extension is visible before an author adds one
- [x] 7.7 Re-check that every path the README names resolves

## 8. Acceptance

- [x] 8.1 `bun test` — 0 fail, no assertion lost against 75 pass / 160 expectations
- [x] 8.2 `bun run typecheck` passes
- [x] 8.3 `bun run verify:readonly` passes, unchanged in scope
- [x] 8.4 `bun run verify:performance` passes with no regression
- [x] 8.5 Both existing TypeScript-only applications build and run unchanged, with no native toolchain involved
- [x] 8.6 An application declaring the probe extension builds on macOS arm64 and Linux x64, and each relocated executable exercises the extension successfully
  - macOS arm64 and Linux x64 both passed with `nativeProbeAnswer: 42` from their relocated executables.
- [x] 8.7 Remove the throwaway probe crate, or keep it only if it earns its place as a permanent test fixture — decide explicitly rather than leaving it by default
- [x] 8.8 `git diff --stat` reviewed: `scripts/build-native.ts` shows no behavioral change to the pinned WebView path
