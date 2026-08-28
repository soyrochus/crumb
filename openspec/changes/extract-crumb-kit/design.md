## Context

See `proposal.md` — Why.

The measurement that shapes this design: of roughly 1,660 lines, about 380 are reusable and about 900 are explorer domain, but the boundary runs *through* files rather than between them. Three files carry the whole difficulty:

- `src/host/main.ts` (57 lines) — window construction, CSP, Wayland guard, and the message loop are kit; the `handlers` object literal and its four entries are app.
- `src/shared/contracts.ts` (94 lines) — `Result`, `DomainError`, `DomainErrorCode`, `RpcMethod` are kit; `ItemDetails`, `DirectoryListing`, and the four preview variants are app. `RpcMethods` is the seam itself: a kit-shaped generic filled with app-specific entries.
- `src/shared/validation.ts` (64 lines) — `expectPlainObject`, `expectNoKeys`, `normalizeAbsolutePath`, and `normalizeError` are reusable; `validateRpcInput` is a hardcoded `if` chain over the explorer's four method names.

Everything else moves whole. `filesystem.ts`, `preview.ts`, `app.ts`, `state.ts`, `index.html`, and `styles.css` are entirely app. `rpc.ts`, `platform.ts`, and `client.ts` are entirely kit, except `RPC_METHODS`, which is app data living in a kit file.

## Goals / Non-Goals

**Goals:**
- Make the boundary a fact on disk, so change 3 and every later change have somewhere unambiguous to put new code.
- Preserve behavior exactly. The suite must report 36 pass / 87 expectations before and after; a changed expectation count means this refactor did something it should not have.
- Make three of `template-identity`'s requirements mechanically checkable rather than review-based.

**Non-Goals:**
- `examples/`, the minimal starter, watch mode, DevTools, CI, prebuilt Linux addon — change 3.
- Improving the explorer, the previews, or the UI. Moved code is moved, not rewritten.
- Changing the RPC wire format, the CSP string, or any window dimension. Values that move into `app.config.ts` move at their current values.
- Supporting more than one application at a time. `app.config.ts` names one entry.

## Decisions

### `src/kit/` and `src/app/`, not `examples/`

The explorer stays the application the repository builds and moves into `src/app/`.

*Why:* this keeps the change a pure extraction with a blunt acceptance test — every existing test still passes against moved files. Introducing `examples/` would simultaneously move the explorer, change what `bun run dev` opens, and require authoring a new minimal app; a failure then has three candidate causes instead of one.

*Alternative considered:* `src/kit/` plus `examples/file-explorer/` with `app.config.ts` selecting an entry, and a minimal starter in `src/app/`. Better final shape, and change 3 can still reach it — `app.config.ts` exists by then, so pointing the build at a different directory is a config edit rather than a restructure. Deferred, not rejected.

### `app.config.ts` declares operations as a validator table, not a method-name list

The kit's router receives a record of operation name → `{ validate, handle }`. `RPC_METHODS` and the `if` chain in `validateRpcInput` both disappear into it.

*Why:* the specified property is that only declared operations are reachable and each input is validated before a handler runs. A name list plus a separate switch satisfies that only by convention — the two can drift, and adding an operation means editing a kit file. A table makes the kit structurally incapable of routing an undeclared operation, and makes "declare an operation" a single-file act in application code.

*Alternative considered:* keeping `RpcMethods` as a type-level map in app code and a name array in the kit. Rejected — it preserves exactly the coupling this change exists to remove.

### Generic validation helpers move to the kit; path validation moves with them

`normalizeAbsolutePath` is filesystem-shaped but not explorer-shaped, and any desktop application taking a path from its UI needs the same NUL-byte and absoluteness checks.

*Why:* leaving it in app code means the next application re-implements a security-relevant check, probably less carefully. It is a validation primitive, not a domain concept.

*Trade-off:* it is the one judgement call in the split where "domain-free" is arguable. Recorded here so it can be revisited rather than rediscovered.

### `RpcMethods` stays a generic the application instantiates

The kit defines the shape (`{ input, output }` per operation) and the `Result` envelope; `src/app/` declares the concrete map. Kit code refers to the type parameter, never to `listDirectory`.

*Why:* it preserves end-to-end type safety across the bridge — the property that makes this template pleasant to build on — without the kit knowing any operation name.

### Split the read-only boundary test along the same seam

`test/read-only-boundary.test.ts` currently does two unrelated jobs. The "exactly four methods" assertion becomes an example test asserting the example declares its four. The static-scan assertion becomes an example test scoped to `src/app/`. A new kit test asserts the router rejects an undeclared operation without invoking a handler.

*Why:* the current test would fail after extraction for the right reason and the wrong cause — it hardcodes both the explorer's method list and a glob over template source. Splitting it turns `desktop-shell` — Narrow declared RPC surface into something actually executed rather than reviewed.

### Move files with `git mv`, in dependency order, verifying between steps

Kit files first (they have no app imports), then app files, then `app.config.ts` and the router rewiring, then scripts, then tests.

*Why:* `git mv` preserves rename detection, keeping the diff reviewable — which matters unusually much here, since "no behavior changed" is the entire claim and a reviewer needs to see that the content is identical. Verifying between steps means a broken step is attributable to that step.

## Risks / Trade-offs

- **The native addon embed breaks silently** → `Bun.build` embeds the addon only when it resolves a statically analyzable literal path. Restructuring build code can turn that into a dynamic expression that still compiles and still runs in development, failing only for a relocated executable on a clean machine. Mitigation: build one target and run the empty-directory relocation check as an acceptance task, not as a spot check.
- **A file is classified wrongly and the boundary leaks quietly** → Add a kit-purity check to the task list: no import in `src/kit/` may resolve into `src/app/`, and the string `crumb` may not appear in application-facing identifiers. Cheap, mechanical, and it converts two review-based requirements into executable ones.
- **Behavior drifts during the move** → The suite is the guard, and it is a good one at 36 tests / 87 expectations across filesystem, preview, validation, state, platform, and the capability boundary. Any change to those counts is treated as a defect in this change, not as an improvement.
- **`bun run verify:performance` regresses from an extra module hop** → Current margins are wide (UI startup 122 ms, 5,000 rows 5 ms, retained RSS 0.1 MiB). Re-run it as an acceptance task; a real regression would be visible immediately.
- **The diff is large enough to hide a substantive edit** → Mitigated by `git mv` plus the ordering above, and by the rule that any file needing genuine edits (`main.ts`, `contracts.ts`, `validation.ts`, `rpc.ts`) is split in its own step with its own verification.

## Migration Plan

No deployment. The repository is on `crumb-refactor`; work continues there and each numbered task group ends with a green suite, so any group can be the rollback point.

1. Create `src/kit/`, move the wholly-kit files, verify.
2. Create `src/app/`, move the wholly-app files, verify.
3. Split the three mixed files, introduce `app.config.ts`, rewire the router, verify.
4. Rename virtual modules and update scripts, verify with a real build.
5. Relocate and split tests, narrow the read-only glob, verify.
6. Update docs to describe what now exists.

## Open Questions

- Whether `src/app/` should later become `examples/file-explorer/` with a minimal starter in its place. Deliberately deferred to change 3, where `app.config.ts` makes it a config edit. It does not affect this change's task breakdown.
