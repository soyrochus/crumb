> **Prerequisite:** `add-rust-extensions` must be applied first. This change consumes the declaration shape, `app:ext/<name>`, embedding, and the shutdown hook it introduces. The Linux x64 path is implemented and accepted first; macOS arm64 verification is an explicit deferred follow-up.

## 1. Dependency due diligence

Done before anything is built on the crate, because the answer can change the choice.

- [x] 1.1 Add `sysinfo` to a scratch crate and build a real Node-API addon for Linux x64
- [x] 1.2 Inspect the produced Linux addon's dynamic dependencies — it adds none beyond permitted operating-system libraries
- [x] 1.3 Confirm the Linux addon does not raise the repository's glibc baseline
- [x] 1.4 Record what it can and cannot supply per platform: processor utilisation, total and used memory, load average, per-process CPU and memory, process state, parent process
- [x] 1.5 If any distribution constraint fails, stop and revisit the crate choice before proceeding — do not absorb the change

## 2. The example skeleton

Mirror `examples/file-explorer/` exactly; deviating from the sibling's shape is its own cost.

- [x] 2.1 Create `examples/activity-monitor/` with `app.config.ts`, `src/host/`, `src/shared/`, `src/ui/`, `test/`, and `native/system-monitor/`
- [x] 2.2 Write `examples/activity-monitor/app.config.ts` with its own window title and dimensions and the template's default CSP
- [x] 2.3 Register it in the root `app.config.ts` alongside the existing applications
- [x] 2.4 Confirm `bun run dev --example=activity-monitor` starts, and that an unknown name still lists every registered application
- [x] 2.5 Confirm `starter` remains the default and the existing applications are unaffected

## 3. The Rust extension

- [x] 3.1 Write the crate under `examples/activity-monitor/native/system-monitor/` and declare it through `nativeExtensions`
- [x] 3.2 Implement a system snapshot: processor utilisation, total and used memory, process count, and load where the platform supplies it
- [x] 3.3 Implement a process list returning identifier, name, processor usage, memory usage, and state — one call for the whole list, not one per process
- [x] 3.4 Implement per-process detail taking an identifier, returning an absent result rather than an error when the process has exited
- [x] 3.5 Represent an unavailable metric explicitly in the return type, so the interface can distinguish "not supported here" from zero
- [x] 3.6 Use `Result` for expected failures and prevent unwinding across the native boundary
- [x] 3.7 Make collection asynchronous, per the design decision — not conditional on an early measurement
- [x] 3.8 Add Rust tests covering structure and the failure cases, including a process disappearing mid-inspection
- [x] 3.9 Confirm `bun run dev --example=activity-monitor` loads the extension and returns real data

## 4. Declared operations

- [x] 4.1 Declare `systemSnapshot`, `processList`, and `processDetails` with validators — no-argument operations reject any key, `processDetails` requires an identifier and rejects unknown keys
- [x] 4.2 Normalize native results into the application's serializable contract before they cross to the page
- [x] 4.3 Normalize native failures into recoverable application errors; a failed metric must not take down the whole response
- [x] 4.4 Confirm the declared operations are read-only — nothing terminates, suspends, or reprioritises a process, and no such operation exists
- [x] 4.5 Add example tests for each validator, mirroring `examples/file-explorer/test/validators.test.ts`

## 5. The interface

- [x] 5.1 Build the summary: processor utilisation, total and used memory, process count, each with units
- [x] 5.2 Show an unavailable metric as unavailable — never zero, never an invented figure
- [x] 5.3 Build the process table with sortable columns and a visible indication of the active sort column and direction
- [x] 5.4 Render process names as text; confirm a name containing markup, control characters, or a script-like string is displayed literally and never interpreted
- [x] 5.5 Show per-process detail on selection, with no control capable of acting on the process
- [x] 5.6 Test the interface layer against fixture data — no test asserts a live system value
- [x] 5.7 Keep the UI ordinary HTML, CSS, and TypeScript; the interesting part is underneath it

## 6. Refresh and shutdown

- [x] 6.1 Refresh on explicit request
- [x] 6.2 Never start a refresh while one is outstanding
- [x] 6.3 Discard a superseded result so an earlier sample finishing last cannot replace newer data
- [x] 6.4 Register shutdown work so sampling in flight when the window closes stops rather than being abandoned — this is the first real exercise of the hook `add-rust-extensions` adds
- [x] 6.5 Confirm the interface stays responsive while collection runs, on a machine with a large process count
- [x] 6.6 Keep bounded auto-refresh opt-in at five seconds, and record the choice

## 7. Linux x64 and relocation

- [x] 7.1 Build for Linux x64; confirm the extension is embedded
- [x] 7.2 Copy the Linux executable alone to an empty directory and confirm it collects and displays a **real** system snapshot and process list — launching the window is not sufficient evidence
- [x] 7.3 Artifact inspection reports only permitted Linux dependencies
- [x] 7.4 Record the Linux behavior and the deferred macOS verification; confirm the interface represents unavailable metrics honestly
- [x] 7.5 Measure the added Rust compile, cache lookup, and selected-application build time on Linux

## 8. Documentation

- [x] 8.1 Present the two examples for what they are: `file-explorer` as the TypeScript-only worked example, `activity-monitor` as the native-extension worked example
- [x] 8.2 Document running it: `bun run dev --example=activity-monitor`
- [x] 8.3 State that building it requires a Rust toolchain, while `starter` and `file-explorer` declare no application extension crate
- [x] 8.4 Note the Linux behavior recorded in 7.4 and that macOS arm64 verification is deferred
- [x] 8.5 Record the Linux build cost from 7.5 beside the existing extension cost figures
- [x] 8.6 Re-check that every path the README names resolves

## 9. Acceptance

- [x] 9.1 `bun test` — 0 fail, no assertion lost
- [x] 9.2 `bun run typecheck` passes
- [x] 9.3 `bun run verify:readonly` passes, still scoped to `examples/file-explorer/` and making no claim about this example's native code
- [x] 9.4 `bun run verify:performance` passes with no regression
- [x] 9.5 `starter`, `file-explorer`, and `native-probe` build unchanged; the first two declare no application extension crate
- [x] 9.6 `activity-monitor` builds on Linux x64 and its relocated executable returns real system data
- [x] 9.7 Confirm no declared operation in the repository can act on a process
- [x] 9.8 Confirm the example's layout matches `examples/file-explorer/` — same shape, plus `native/`

## 10. Deferred macOS arm64 follow-up

These checks are intentionally not part of the Linux-first implementation requested on 2026-08-28.

- [x] 10.1 Build the `sysinfo` Node-API addon for macOS arm64 and inspect its dynamic dependencies and minimum macOS version
- [x] 10.2 Build `activity-monitor` for macOS arm64 and confirm the extension is embedded
- [x] 10.3 Relocate the macOS executable by itself and confirm it returns a real snapshot and process list
- [x] 10.4 Record macOS-specific metric behavior and the added macOS all-applications build time
- [x] 10.5 Complete cross-platform acceptance after the deferred checks pass
