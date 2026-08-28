## Context

See `proposal.md` — Why, and `specs/native-extensions-for-crumb.md` §15 for the original sketch.

Three constraints from the existing repository shape this.

**The example shape is already settled.** `examples/file-explorer/` has `app.config.ts`, `src/host/`, `src/shared/`, `src/ui/`, and `test/`, is registered in the root `app.config.ts`, and is selected with `--example=<name>`. `activity-monitor` is that shape plus a `native/` directory. Nothing structural needs inventing, and deviating from the sibling's layout would be its own small cost.

**It depends on `add-rust-extensions` and cannot start early.** That change proves Cargo invocation on both targets, `app:ext/<name>`, embedding, and the shutdown hook. Building the example before those exist means debugging the mechanism and its first consumer simultaneously — the exact trap the probe crate was introduced to avoid.

**This is the first application in the repository that needs Cargo.** `file-explorer` and `starter` are TypeScript-only. Adding it means "build all applications" compiles Rust on both targets, which lands in the release workflow that was already made tag-only over one addon.

## Goals / Non-Goals

**Goals:**
- Show a capability that genuinely belongs in native code, in an application that is otherwise an ordinary Crumb web app.
- Exercise the parts of `native-extensions` the probe crate cannot: structured return types, repeated calls, platform differences, non-blocking work, and real failure cases.
- Stay readable as an example. Someone should be able to see where TypeScript ends and Rust begins without tracing the build.

**Non-Goals:**
- Matching a platform's own tooling numerically. The example demonstrates the model, not a competitor to Activity Monitor or `htop`.
- Process control of any kind — see the decision below.
- Historical graphing, disk and network panels beyond a first version, or Windows.
- Making `activity-monitor` the default application. `starter` remains what a clone opens.

## Decisions

### Inspection only: no kill, suspend, or renice

*Why:* two reasons, and the second is the stronger. First, acting on processes adds no demonstrative value — a native call returning a process list proves the mechanism exactly as well as one that terminates a process. Second, this is example code that people will copy. Shipping a worked example containing a validated operation that terminates processes hands every reader a destructive primitive one edit away from their own application, and the read-only file explorer sets the precedent that examples restrict themselves for their own reasons.

*Consequence:* the spec states this as a requirement rather than an omission, so it cannot be quietly added later without amending the capability.

### A cross-platform crate, with room for platform-specific code

Use an established crate such as `sysinfo` for collection rather than writing per-platform system calls.

*Why:* the subject of the example is the *integration* — Cargo to Node-API to Bun to the page — not the system programming. Hand-written `sysctl` and `/proc` code would triple the crate's size and put the interesting part in the background. It also matches how a real author would work.

*Alternative considered:* deliberately writing one metric with a direct platform API to show that path. Worth doing only if it stays small; noted as an open question rather than committed to, because it is a teaching decision that is easier to make against working code.

*Constraint:* the crate must not introduce a dynamic library, raise the minimum macOS version, or raise the glibc baseline. `standalone-distribution` requires any such change to be reported, and this example must not be what erodes the single-executable promise.

### Collection is asynchronous from the start

Process enumeration goes through the non-blocking path even if an early measurement suggests it is fast enough synchronously.

*Why:* process count varies by two orders of magnitude across machines, so a synchronous call that is fine on a development laptop can freeze a window on a loaded server. The host owns the window's event loop, so the failure mode is a frozen interface, not merely a slow response. This is also the example's job: to be the thing that proves the asynchronous path works.

### Coarse operations, not per-process calls

One call returns the whole process list. Per-process detail is a second operation taking an identifier.

*Why:* `native-extensions` requires aggregation over thousands of boundary crossings, and a table of several hundred processes is exactly where a naive design would cross the boundary once per row. The example should demonstrate the shape the requirement asks for.

### Snapshot data is untrusted

Process names are rendered as text through the same discipline `file-explorer` applies to filenames.

*Why:* a process name is attacker-influenceable on a shared machine, and an example that interpolated one into markup would teach the wrong lesson in the most copied file in the repository.

## Risks / Trade-offs

- **Platform differences make the two builds behave visibly differently** → Accepted and made explicit: the spec requires an unavailable metric to be shown as unavailable rather than as zero. The example is more honest, and more instructive, for showing where a platform cannot answer.
- **Rust compilation becomes part of every full build** → Real cost, landing on a release workflow already made tag-only. Not solvable here; it is more evidence for the deferred prebuilt-addon change. Worth measuring as a task so the number exists.
- **`sysinfo` pulls in a dependency that breaks relocation** → Checked before the example is built out, not after. If it introduces a dynamic library or raises a platform baseline, the decision to use it is revisited rather than absorbed.
- **The example grows into a product** → Scope creep is the likely failure here: graphs, filters, disk and network panels. The non-goals are written down so additions have to argue against them.
- **Live system data makes tests flaky** → The TypeScript layer is tested against fixtures; native collection is verified in Rust and through the standalone journey. No test asserts a live system value.

## Migration Plan

No deployment. Applied after `add-rust-extensions`.

1. Confirm the dependency crate satisfies the distribution constraints before building anything on it.
2. The Rust extension: system snapshot, process list, per-process detail.
3. The declared operations and their validators.
4. The user interface against fixture data.
5. Wire the interface to the real operations; add refresh and shutdown behaviour.
6. Register the application and verify both targets, including a relocated executable.
7. Documentation presenting the two examples.

## Open Questions

- Whether one metric should be collected through a direct platform API rather than the cross-platform crate, to demonstrate that path. A teaching decision, easier to judge against working code, and it changes neither the structure nor the task breakdown.
- Whether a bounded auto-refresh interval should be on by default or opt-in. Affects one default value, not the design.
