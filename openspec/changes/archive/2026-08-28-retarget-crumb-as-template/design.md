## Context

See `proposal.md` — Why.

The constraint that shapes this design is that the repository is already about three-quarters template by volume — roughly 380 lines of reusable shell and build machinery against roughly 900 lines of file-explorer domain — but the two are interleaved inside single files (`src/host/main.ts` mixes bootstrap with handler wiring; `src/shared/contracts.ts` mixes `Result`/`RpcMethods` with `DirectoryListing`; `src/shared/validation.ts` hardcodes an `if` chain over the explorer's four methods). The same interleaving exists in the specs, and it is worse there because a spec is a promise: `desktop-shell` currently guarantees read-only-ness to every future application, and `three-pane-interface` owns the CSP that every future application needs.

Extraction cannot begin until the boundary is written down, because the extraction has no acceptance criterion otherwise. This change writes the boundary and changes no code.

## Goals / Non-Goals

**Goals:**
- Produce a spec set in which every capability is unambiguously a template promise or an example-app requirement, so change 2 has a target to move files toward.
- Preserve every existing behavioral guarantee. Requirements move between capabilities and lose example-specific literals; none is weakened or deleted outright.
- Leave the repository green: the full verification suite must pass before and after with no code edits.

**Non-Goals:**
- Creating `src/kit/`, `examples/`, or `app.config.ts` — change 2.
- Renaming `crumb:ui` / `crumb:native` in code — change 2. This change documents the rename as the target and adds the normative rule requiring it.
- Rescoping `scripts/verify-readonly.ts` — change 2, since the glob cannot be narrowed before the directories exist.
- Windows support, CI, watch mode, or the minimal example — change 3 or later.
- Renaming spec *directories*. See Decisions.

## Decisions

### Move requirements between capabilities; do not move capability directories

`filesystem-browsing`, `file-preview`, and `three-pane-interface` become example-app capabilities by having their Purpose say so, not by relocating to `specs/examples/file-explorer/`.

*Why:* OpenSpec deltas express requirement-level moves cleanly (REMOVED here, ADDED there) and explicitly instruct against moving or renaming an existing capability. A directory move would be a rename of five capability paths in one change, breaking the delta model and every archived reference, in exchange for cosmetic nesting. The project also uses a flat spec layout today, and the instructions say not to introduce a domain level where the project is flat.

*Alternative considered:* nesting under `specs/examples/file-explorer/`. Deferred — it can be done later as an isolated rename once the ownership labels are settled and proven useful.

### Use REMOVED + ADDED, not RENAMED + MODIFIED, for the RPC surface requirement

"Narrow read-only RPC surface" is removed from `desktop-shell` with a Reason and Migration, and "Narrow declared RPC surface" is added.

*Why:* both the requirement name and its content change. RENAMED is documented for name-only changes, and MODIFIED matches the existing requirement by header text — a MODIFIED block under a new name would not match and would fail silently or duplicate. REMOVED + ADDED is unambiguous at archive time, and the Reason/Migration pair leaves an auditable record of *why* a security-shaped guarantee was reworded — which matters more here than anywhere else in the change.

The CSP move out of `three-pane-interface` uses the same pattern for the same reason.

### Introduce `template-identity` as a capability rather than documenting the boundary only in prose

*Why:* change 2's acceptance criterion is "the boundary holds." If the boundary lives only in `README.md`, there is nothing to check the extraction against, and the ownership question gets re-argued file by file during the refactor. As a capability, "template-owned artifacts MUST NOT depend on an application's types" is a reviewable rule that governs the other four capabilities.

*Alternative considered:* setting `skip_specs: true` and treating this as a pure documentation change. Rejected — it would make change 1 unverifiable and change 2 unbounded.

### Keep the read-only constraint intact, and move only its ownership

The `file-explorer` example stays view-only, its static check keeps running, and no test changes. What changes is that the rule is recorded under `filesystem-browsing` as a constraint the example adopts for its own simplicity, and the template stops asserting it on behalf of applications it has never seen.

*Why:* the constraint is genuinely valuable for the example — it is what makes a file browser auditable — and genuinely wrong as a template promise, since most local desktop applications write files. Both facts are satisfied by re-filing rather than by relaxing or by inventing a policy-preset mechanism.

*Alternative considered:* a configurable policy preset system (read-only / single-root / unrestricted) in `app.config.ts`. Rejected as overbuilt: the template needs no policy engine, only a check scoped to the application that wants it.

### Edit Purpose sections in the main specs directly

All five capabilities carry `TBD - created by archiving change build-crumb-file-explorer`. New-capability Purpose text travels through the delta; for existing capabilities the delta's Purpose is ignored, so those five are edited in place under `openspec/specs/` as part of this change's tasks.

### Documentation describes today's layout, and labels tomorrow's as the target

`README.md` — Project structure keeps describing `src/host/`, `src/ui/`, `src/shared/` as they exist. The `src/kit/` ÷ `examples/` layout appears in a clearly marked forward-looking section owned by change 2.

*Why:* a template whose README documents directories that do not exist is worse than one with an out-of-date purpose. The retarget is credible only if every path it names resolves.

## Risks / Trade-offs

- **A reader concludes the read-only guarantee was dropped for safety reasons** → The REMOVED block in `desktop-shell` states the reason and migration explicitly, the `filesystem-browsing` requirement restates the constraint in full, and the README says the example remains view-only. The running example and its verification are unchanged, and this is checkable: `bun run verify:readonly` passes identically after this change.
- **The README loses the Bun-demonstration narrative, which is the project's best existing writing** → Keep the Bun feature table and the Wayland-patch walkthrough intact. They stop being "why the explorer exists" and become "what the toolchain does" — which is a stronger frame for a template, not a weaker one.
- **`template-identity` requirements are review-based rather than mechanically testable** → Accepted for this change; specs may lead implementation. Change 2 makes three of them mechanically checkable (no `crumb` string in application-facing identifiers; template source imports no application types; the example directory can be deleted and the build still succeeds).
- **Purpose and specs now describe a template while the code is still shaped as one app** → This is the deliberate cost of sequencing docs first, and it is bounded: change 2 follows immediately, and the forward-looking section names it.
- **Screenshots and badges still show a file explorer** → Acceptable. They illustrate the example, and the captions will say so.

## Migration Plan

Documentation and specification artifacts only; nothing ships and nothing is deployed.

1. Land the spec deltas and Purpose rewrites.
2. Land the `README.md` retarget in the same change so the repository is never internally contradictory, and add a superseded notice to the retained historical specification.
3. Verify with the existing suite unchanged: `bun test`, `bun run typecheck`, `bun run verify:performance`, `bun run verify:readonly`. Any failure means code was touched, which is out of scope for this change.

Rollback is `git revert` of a single commit; no build artifact, binary, or consumer is affected.

## Open Questions

- Whether example capabilities eventually nest under `specs/examples/file-explorer/`. Safely deferrable: the ownership labels land now, and the directory shape can follow once change 2 shows whether the nesting earns its keep.
- Whether Windows moves from "out of scope" to a stated roadmap position. It changes the README's framing but not this change's specs, approach, or tasks.
