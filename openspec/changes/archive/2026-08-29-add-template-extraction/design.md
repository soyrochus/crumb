## Context

Crumb already draws a hard line between template-owned and application-owned
artifacts (`template-identity` spec: "Every source, script, and specification
artifact SHALL be classifiable as template-owned or application-owned"). Nothing
under `src/kit/` imports from `src/app/`, and moving `src/app/` aside leaves the
kit typechecking cleanly. That boundary is what makes an extraction command
possible: the template-owned set is a well-defined slice of the repository.

The repo-level `main.ts` and `app.config.ts` sit on the boundary. `main.ts` is
template-owned (it only wires the kit to a registry). The root `app.config.ts`
is the registry — its shape is template-owned but its contents name
applications, so the shipped file imports the starter and the examples and
cannot be extracted verbatim.

Only two scripts reference `examples/`: `verify-readonly.ts` and
`verify-performance.ts`, both of which exist to check the `file-explorer`
example. Every script in the core dev/build pipeline (`dev.ts`, `build.ts`,
`build-native.ts`, `build-ui.ts`, `build-extensions.ts`,
`rebuild-extensions.ts`, `runner.ts`, `start-runtime.ts`,
`native-extension-config.ts`, `extension-preload.ts`, `ui-artifact.ts`,
`watch-roots.ts`) is example-free.

Crumb also already ships assistant skills from a canonical vendor-neutral
`skills/` directory that `scripts/install-skills.ts` discovers dynamically (no
hard-coded list) and distributes to `.claude/skills/`, `.codex/skills/`, and
`.github/skills/`; committed copies are kept honest by `install:skills --check`.
Adding a skill is a new `skills/<name>/` directory plus its regenerated
committed copies.

The user has chosen: name the command `extract`, stage everything into a
`crumb-source/` directory in the target, copy the kit and pipeline only (no
starter scaffold), add an `crumb-adopt-existing-project` skill that performs the
merge, and specify all of it through OpenSpec before implementing.

## Goals / Non-Goals

**Goals:**

- One command, run from a Crumb clone, that produces a `crumb-source/` staging
  directory inside an external target containing every template-owned file
  required to run `bun run dev` and `bun run build` once applied.
- Absolute safety for both endpoints: the script never writes outside
  `<target>/crumb-source/`, and never writes inside the Crumb clone.
- A machine- and human-readable manifest of what was staged and what the
  developer must still do by hand (merge manifest entries, apply files, create a
  registry, add their UI under `src/app/`).
- A preview mode that computes and reports the plan without creating anything.
- The staged set is defined by an explicit allowlist in the script, not by
  "copy everything except a denylist", so a new example or doc directory can
  never leak into an extract output.
- An assistant skill that turns the staged output into a running Crumb
  application inside the existing project, carrying the merge decisions the
  script deliberately does not make.

**Non-Goals:**

- Having the *script* apply the staged files into their final positions. That is
  the skill's job (or a developer's), because it involves merge decisions.
- The script editing the target's `package.json`, `.gitignore`,
  `tsconfig.json`, or any other existing file.
- Scaffolding a starter application or copying `src/app/`. The developer brings
  their own web app.
- Copying `examples/`, `openspec/`, `skills/`, `specs/`, `docs/`, `images/`, or
  `README.md`.
- Turning Crumb into an installable package or a `create-*` initializer. This is
  an extraction from a clone, nothing more.
- Keeping an extracted copy in sync with later Crumb versions (re-running the
  script re-stages; reconciliation stays manual or skill-assisted).

## Decisions

### Decision: The command is named `extract`

`bun run extract -- --dest <path>`. The command extracts the template-owned
machinery from the clone into a staging directory in the target.

Rationale: it is literally what happens and needs no packaging-ecosystem
background to understand. "vendor" (the earlier working name) is accurate jargon
— the result is a vendored copy — but it is inverted from the convention
(`cargo vendor` is run by the consumer, pulling inward; this runs from the
source, pushing outward), it is not reinforced by the `crumb-source/` output
name, and it collides with the repo's existing use of "vendor-neutral". `eject`
was rejected because its established meaning (Create React App) is "reveal
hidden internals, in place, irreversibly", none of which applies.

### Decision: Stage into an inert `crumb-source/` directory rather than merge in place

The script copies the allowlisted tree into `<target>/crumb-source/`, preserving
relative paths (`crumb-source/src/kit/...`, `crumb-source/scripts/...`). It does
not place files at their final destinations.

Rationale: the target is an existing project with its own layout, tooling, and
history. A direct merge would have to make judgement calls (does their
`tsconfig.json` win, or ours? is their `scripts/` ours to write into?). Staging
defers every such call to the skill or a human who can see both trees. It also
makes the operation trivially reversible — delete one directory.

Alternatives considered:

- *Direct skip-existing merge*: copy into final positions, skip any path that
  exists. Faster to a runnable state, but silently skipping a file the target
  happens to have (e.g. a `scripts/build.ts` of their own) produces a broken
  hybrid that is hard to diagnose. Rejected as the default; may be revisited as
  an opt-in later.
- *Emit a patch/tarball*: portable but adds an unpacking step and hides the
  contents. A plain directory is inspectable with `ls`.

### Decision: The script does the mechanical copy; the skill does the merge

Two deliverables, split along whether the work is deterministic:

- **`scripts/extract.ts`** owns everything a machine can get exactly right every
  time: the allowlist of template-owned paths, the safety guards (never write
  the clone, never overwrite the target, refuse a nested target), the copy into
  `crumb-source/`, the fragments, and the manifest. It is covered by kit tests
  and needs no assistant.
- **`skills/crumb-adopt-existing-project/`** owns the judgement: run `extract`,
  then apply `crumb-source/` into the project — merge the `package.json`
  fragment, reconcile the target's `tsconfig.json` against the template's
  (compiler options the kit requires), move the template files into place, map
  the developer's existing HTML/CSS/entry into `src/app/ui/`, adjust a
  framework build so the interface bundles from a single `uiScript` entry with
  no runtime server, write `src/app/app.config.ts` and the root registry, run
  `bun install`, and reach a working `bun run dev`.

Rationale: the safety guarantees people most need (nothing destroyed, nothing
leaked from the clone) must not depend on an LLM executing correctly, so they
live in tested code. The parts that genuinely vary per project — build tooling,
file layout, framework — are where an assistant is actually useful, and encoding
them as a skill is how this repository already ships that kind of guidance.
The skill's first step invokes the script, so they compose rather than overlap.

This skill is a **one-time onboarding** operation, unlike the recurring
multi-file ceremonies the other skills cover (`crumb-add-operation`,
`crumb-add-native-extension`, `crumb-new-application`). It still qualifies as
skill-worthy under `agent-skills` ("a partially correct result builds, runs, and
is wrong"): a half-merged project builds the wrong thing.

### Decision: Skill existence is owned by `template-extraction`, not `agent-skills`

`agent-skills` requirements govern the skill *system* — canonical source,
one-command install, drift check, subordination to docs — and none of them
change or name skills individually. The `agent-skills` spec already has a
`Scenario: Add a skill` that covers introducing a new one. This change therefore
adds a requirement to the new `template-extraction` spec stating that an
assistant skill covers applying the extracted files, and leaves `agent-skills`
untouched.

### Decision: Explicit allowlist, verified against the repo at runtime

The script holds a literal list of template-owned path roots. Before copying it
asserts each one exists in the clone; a missing entry is a hard error (the
template moved and the script is stale). The list:

- `src/kit/` (recursive)
- `scripts/` (recursive) minus `extract.ts`, `verify-readonly.ts`,
  `verify-performance.ts`, `feasibility.ts`, `install-skills.ts`
- `native/nativewindow-webview-v1.0.6-wayland.patch`
- `main.ts`
- `tsconfig.json`
- `test/kit/` (recursive) — staged, since the how-to tells developers to keep
  template tests

Rationale: a denylist ("everything except examples/, openspec/, ...") fails open
— a future top-level directory would be extracted by accident. An allowlist
fails closed and doubles as documentation of the boundary.

### Decision: Merge-required files delivered as fragments, never as files

`package.json` and `.gitignore` cannot be dropped into a target that already has
them. The script writes:

- `crumb-source/MERGE.md` — ordered manual steps, and a pointer to the
  `crumb-adopt-existing-project` skill for an assistant-driven apply.
- `crumb-source/fragments/package.json` — an object with just the `scripts`,
  `dependencies`, and `devDependencies` keys Crumb needs, for merging.
- `crumb-source/fragments/gitignore` — the `node_modules/`, `dist/`, `.build/`
  lines.
- `crumb-source/fragments/app.config.ts` — a trimmed single-app registry
  (`default: "starter"`, `applications: { starter }`) for the developer to place
  at their project root once they have a `src/app/app.config.ts`.

Rationale: keeps the "never edit an existing file" guarantee absolute while
still handing over everything needed.

### Decision: Invocation and location

Add `"extract": "bun run scripts/extract.ts"` to `package.json`. Usage:

```sh
bun run extract -- --dest <path> [--dry-run] [--force]
```

- `--dest` (required): target project directory. Must exist and be a directory.
- `--dry-run`: print the plan, write nothing.
- `--force`: allow staging when `<dest>/crumb-source/` already exists
  (contents are overwritten file-by-file; unknown files there are left alone).
  Without it, a pre-existing non-empty `crumb-source/` is a hard error.

The script refuses to run if `--dest` resolves to a path inside the Crumb clone,
and refuses if the clone is not recognizably a Crumb repo (allowlist assertion
above).

### Decision: Output manifest

On success (and in `--dry-run`) the script prints:

- each staged path with a copied / skipped / would-copy marker,
- a count summary,
- the ordered contents of `MERGE.md` as the "next steps".

Exit non-zero on any error (bad `--dest`, stale allowlist, existing
`crumb-source/` without `--force`, write failure).

## Risks / Trade-offs

- **Staged copy drifts from the Crumb version it came from** → `MERGE.md`
  records the Crumb `package.json` version and git SHA at stage time so a
  developer can tell what they extracted; re-running re-stages cleanly.
- **Developer applies files but forgets a manual merge step, gets a confusing
  failure** → `MERGE.md` is ordered and each step names the symptom of skipping
  it; the script's stdout repeats the steps; the skill automates them.
- **Allowlist goes stale when the template is refactored** → a kit test
  enumerates the allowlist and asserts every entry still exists, so a rename
  breaks CI, not a user's extract run.
- **Skill drives a destructive merge in the target project** → the skill
  operates on the developer's own repository under their supervision; it is
  instructed to rely on the developer's version control and to stage changes for
  review rather than assume a clean apply. The script half, which people run
  first, still guarantees nothing outside `crumb-source/` is touched.
- **Someone expects `crumb-source/` to be runnable as-is** → it is not (no
  `src/app/`, no merged manifest); `MERGE.md` and the docs state this plainly.
- **`--force` overwriting a hand-modified staged file** → documented; `--force`
  is opt-in and only touches paths the script itself stages.
- **Skill and script disagree over time** → the skill points at `MERGE.md` and
  the how-to as authoritative for the ceremony and only encodes the
  project-shaped judgement, per the `agent-skills` subordination requirement.
