> **Prerequisite:** `add-rust-extensions` must be applied first. This change consumes the declaration shape, `app:ext/<name>`, embedding, and the shutdown hook it introduces. Do not start group 2 until the probe crate has proven the path on both targets.

## 1. Dependency due diligence

Done before anything is built on the crate, because the answer can change the choice.

- [ ] 1.1 Add the candidate collection crate (`sysinfo` or equivalent) to a scratch crate and build it for macOS arm64 and Linux x64
- [ ] 1.2 Inspect the produced addon's dynamic dependencies on both targets — it must add none beyond permitted operating-system libraries
- [ ] 1.3 Confirm it does not raise the minimum macOS version or the glibc baseline
- [ ] 1.4 Record what it can and cannot supply per platform: processor utilisation, total and used memory, load average, per-process CPU and memory, process state, parent process
- [ ] 1.5 If any distribution constraint fails, stop and revisit the crate choice before proceeding — do not absorb the change

## 2. The example skeleton

Mirror `examples/file-explorer/` exactly; deviating from the sibling's shape is its own cost.

- [ ] 2.1 Create `examples/activity-monitor/` with `app.config.ts`, `src/host/`, `src/shared/`, `src/ui/`, `test/`, and `native/system-monitor/`
- [ ] 2.2 Write `examples/activity-monitor/app.config.ts` with its own window title and dimensions and the template's default CSP
- [ ] 2.3 Register it in the root `app.config.ts` alongside `starter` and `file-explorer`
- [ ] 2.4 Confirm `bun run dev --example=activity-monitor` starts, and that an unknown name still lists all three applications
- [ ] 2.5 Confirm `starter` remains the default and the other two applications are unaffected

## 3. The Rust extension

- [ ] 3.1 Write the crate under `examples/activity-monitor/native/system-monitor/` and declare it through `nativeExtensions`
- [ ] 3.2 Implement a system snapshot: processor utilisation, total and used memory, process count, and load where the platform supplies it
- [ ] 3.3 Implement a process list returning identifier, name, processor usage, memory usage, and state — one call for the whole list, not one per process
- [ ] 3.4 Implement per-process detail taking an identifier, returning an absent result rather than an error when the process has exited
- [ ] 3.5 Represent an unavailable metric explicitly in the return type, so the interface can distinguish "not supported here" from zero
- [ ] 3.6 Use `Result` for expected failures and prevent unwinding across the native boundary
- [ ] 3.7 Make collection asynchronous, per the design decision — not conditional on an early measurement
- [ ] 3.8 Add Rust tests covering structure and the failure cases, including a process disappearing mid-inspection
- [ ] 3.9 Confirm `bun run dev --example=activity-monitor` loads the extension and returns real data

## 4. Declared operations

- [ ] 4.1 Declare `systemSnapshot`, `processList`, and `processDetails` with validators — no-argument operations reject any key, `processDetails` requires an identifier and rejects unknown keys
- [ ] 4.2 Normalize native results into the application's serializable contract before they cross to the page
- [ ] 4.3 Normalize native failures into recoverable application errors; a failed metric must not take down the whole response
- [ ] 4.4 Confirm the declared operations are read-only — nothing terminates, suspends, or reprioritises a process, and no such operation exists
- [ ] 4.5 Add example tests for each validator, mirroring `examples/file-explorer/test/validators.test.ts`

## 5. The interface

- [ ] 5.1 Build the summary: processor utilisation, total and used memory, process count, each with units
- [ ] 5.2 Show an unavailable metric as unavailable — never zero, never an invented figure
- [ ] 5.3 Build the process table with sortable columns and a visible indication of the active sort column and direction
- [ ] 5.4 Render process names as text; confirm a name containing markup, control characters, or a script-like string is displayed literally and never interpreted
- [ ] 5.5 Show per-process detail on selection, with no control capable of acting on the process
- [ ] 5.6 Test the interface layer against fixture data — no test asserts a live system value
- [ ] 5.7 Keep the UI ordinary HTML, CSS, and TypeScript; the interesting part is underneath it

## 6. Refresh and shutdown

- [ ] 6.1 Refresh on explicit request
- [ ] 6.2 Never start a refresh while one is outstanding
- [ ] 6.3 Discard a superseded result so an earlier sample finishing last cannot replace newer data
- [ ] 6.4 Register shutdown work so sampling in flight when the window closes stops rather than being abandoned — this is the first real exercise of the hook `add-rust-extensions` adds
- [ ] 6.5 Confirm the interface stays responsive while collection runs, on a machine with a large process count
- [ ] 6.6 Decide whether bounded auto-refresh is on by default, and record the choice

## 7. Both targets and relocation

- [ ] 7.1 Build for macOS arm64; confirm the extension is embedded
- [ ] 7.2 Build for Linux x64; confirm the extension is embedded
- [ ] 7.3 Copy each executable alone to an empty directory and confirm it collects and displays a **real** system snapshot and process list — launching the window is not sufficient evidence
- [ ] 7.4 Artifact inspection reports only permitted dependencies on both targets
- [ ] 7.5 Record the observed platform differences and confirm the interface presents them honestly
- [ ] 7.6 Measure the added build time for a full all-applications build on both targets

## 8. Documentation

- [ ] 8.1 Present the two examples for what they are: `file-explorer` as the TypeScript-only worked example, `activity-monitor` as the native-extension worked example
- [ ] 8.2 Document running it: `bun run dev --example=activity-monitor`
- [ ] 8.3 State that building it requires a Rust toolchain, and that the other two applications still do not
- [ ] 8.4 Note the platform differences recorded in 7.5
- [ ] 8.5 Record the build cost from 7.6 beside the existing extension cost figures
- [ ] 8.6 Re-check that every path the README names resolves

## 9. Acceptance

- [ ] 9.1 `bun test` — 0 fail, no assertion lost
- [ ] 9.2 `bun run typecheck` passes
- [ ] 9.3 `bun run verify:readonly` passes, still scoped to `examples/file-explorer/` and making no claim about this example's native code
- [ ] 9.4 `bun run verify:performance` passes with no regression
- [ ] 9.5 `starter` and `file-explorer` build and run unchanged, with no Rust toolchain involved
- [ ] 9.6 `activity-monitor` builds on both targets and each relocated executable returns real system data
- [ ] 9.7 Confirm no declared operation in the repository can act on a process
- [ ] 9.8 Confirm the example's layout matches `examples/file-explorer/` — same shape, plus `native/`
