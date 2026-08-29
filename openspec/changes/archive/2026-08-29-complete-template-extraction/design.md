## Context

`add-template-extraction` (archived 2026-08-29) built `scripts/extract.ts` with
a minimal allowlist: `src/kit`, `scripts` (minus five example/self scripts),
`native/…patch`, `main.ts`, `tsconfig.json`, `test/kit`. It stages into
`<dest>/crumb-source/` plus `fragments/` and `MERGE.md`, never touching the
clone or existing target files.

The gap surfaced immediately on first real use: after extracting into a project
and starting to apply `crumb-source/`, `bun run install:skills` failed —
`extract` had deliberately withheld it. The `crumb-adopt-existing-project` skill
and `MERGE.md` both told the developer to run a command the extract does not
provide, and the four Crumb skills cite `../../docs/…` and `../../openspec/specs/`
paths that are not present in a target.

The correcting principle: **an extracted destination is a complete, offline
Crumb template.** Everything template-owned comes over; only genuinely
application-owned material (the worked examples) and checks that depend on it
stay behind.

The user chose: copy `docs/`; repoint the skills' `openspec/specs/` citation to
the GitHub URL rather than copy `openspec/`; keep `examples/` and `verify:*`
out.

## Goals / Non-Goals

**Goals:**

- After applying `crumb-source/`, every documented Crumb command runs in the
  target with no path back to the clone: `bun run dev`, `bun run build`,
  `bun run build:native`, `bun run build:ui`, `bun run rebuild:extensions`,
  `bun run install:skills` (and `--check`, `--list`), `bun run extract`,
  `bun test`, `bun run typecheck`.
- The four Crumb skills are present in the target and usable by an assistant
  immediately, with their document references resolving (locally for `docs/`, to
  the canonical repo URL for `openspec/specs/`).
- The exclusions (`examples/`, `verify:readonly`, `verify:performance`) are a
  stated, reasoned boundary, not an oversight.

**Non-Goals:**

- Copying the worked example applications or a Rust example crate into someone's
  project.
- Copying `openspec/` — the target has its own planning home.
- Making `extract` transform staged file contents. The skills are fixed at their
  canonical source so the staged copies remain verbatim.
- Changing the staging model, the safety guards, or the fragment mechanism from
  `add-template-extraction`.

## Decisions

### Decision: The staged set is "self-contained template", not "minimal machinery"

New allowlist (relative to repo root):

- `src/kit` — unchanged
- `scripts` — unchanged recursion, but the exclusion set shrinks to
  `verify-readonly.ts`, `verify-performance.ts` only. `extract.ts`,
  `install-skills.ts`, and `feasibility.ts` are now staged.
- `native/nativewindow-webview-v1.0.6-wayland.patch` — unchanged
- `main.ts`, `tsconfig.json` — unchanged
- `test/kit` — unchanged
- `skills` — **new**, recursive (canonical `crumb-*` sources + `README.md`)
- `docs` — **new**, recursive
- the installed skill copies — **new**: for each of `.claude/skills`,
  `.codex/skills`, `.github/skills`, every subdirectory whose name begins with
  `crumb-`. The `openspec-*` skills in those directories belong to the OpenSpec
  CLI, not Crumb, and are not staged.

`verify-readonly.ts` and `verify-performance.ts` stay excluded because they
`import` from `examples/file-explorer/`; staging them without `examples/` would
break `bun run typecheck` in the target. `examples/` itself stays excluded
because `template-identity` classifies the worked apps as application-owned.

### Decision: Exclude the registry-coupled kit tests

Three files under `test/kit/` assert against the Crumb repository's *own*
registry composition rather than against the kit: `application-registry.test.ts`
(expects the exact set `activity-monitor, crumbbrot, file-explorer,
native-probe, starter` and `dist/file-explorer-…` output names),
`build-time-selection.test.ts` and `native-extension-watch.test.ts` (both
`resolveApplication(registry, "file-explorer")` / `registry.applications["native-probe"]`).
In an extracted project the registry is the trimmed single-`starter` fragment,
so these fail — the same reason `verify-*` are excluded.

`extract` therefore also skips a `TEST_EXCLUSIONS` set of `test/kit/<name>`
basenames. The remaining kit tests (platform, validation, RPC surface,
shutdown, native-extension config/cache, devtools invalidation) are
registry-agnostic and pass. `MERGE.md` notes that the staged `test/kit/` covers
the kit, not the registry.

`feasibility.ts` only needs the kit and the native binding — no example — so it
is template-owned and comes over.

### Decision: `install:skills` returns to the package.json fragment

`FRAGMENT_SCRIPT_EXCLUSIONS` drops to `verify:performance`, `verify:readonly`.
The fragment's `scripts` then carries `dev`, `build`, `build:native`,
`rebuild:extensions`, `build:ui`, `extract`, `install:skills`, `test`,
`typecheck` — everything that works in a target without `examples/`.

### Decision: Fix the skills' `openspec/specs/` link at the source, not in extract

Every shipped skill ends with a line like "the requirements under
`[openspec/specs/](../../openspec/specs/)` are normative". From an installed
copy (`.claude/skills/<name>/SKILL.md`) that relative path resolves to
`.claude/openspec/specs/` and is already broken; in an extracted target there is
no Crumb `openspec/` at all.

Repoint it to `https://github.com/soyrochus/crumb/tree/main/openspec/specs/` in
the canonical `skills/*/SKILL.md`, then regenerate the committed installed
copies. This keeps `extract` a verbatim copier (the staged `skills/` and the
staged `.claude/skills/crumb-*` stay byte-identical, so `install:skills --check`
passes in the target) and fixes the link everywhere at once, including in the
clone.

`docs/` links stay relative (`../../docs/how-to-build-a-desktop-app-with-bun.md`)
because `docs/` is now staged; from `skills/<name>/` that resolves to `docs/` in
both the clone and the target. (The installed-copy relative-path breakage for
`docs/` is pre-existing and out of scope here.)

### Decision: Wording fixes for the extract-not-clone reality

- `skills/crumb-adopt-existing-project/SKILL.md`: the parenthetical "(installed
  into .claude/skills, … by `bun run install:skills`)" becomes "staged into
  `crumb-source/` by `bun run extract`; copy it into your assistant's skills
  directory, or run `bun run install:skills` once the pipeline is in place".
- `MERGE.md` generator in `extract.ts`: same correction, and a step that the
  staged `skills/` + `.claude|.codex|.github/skills/crumb-*` are applied like the
  rest of the tree.
- `README.md` and how-to extraction sections: state the decoupling guarantee and
  that `bun run install:skills` works in the target.

### Decision: Fill the spec Purpose placeholder

The 2026-08-29 archive created `openspec/specs/template-extraction/spec.md` with
`Purpose: TBD`. This change's archive is the natural point to set it; a task
covers editing the main spec Purpose directly after the delta is applied.

## Risks / Trade-offs

- **`docs/` in the target may confuse a reader into thinking it documents their
  app** → the how-to opens by describing Crumb; `MERGE.md` notes `docs/` is
  Crumb's template documentation. Acceptable; the alternative (broken skill
  links) is worse.
- **Staged installed skill copies land beside a target's own or another tool's
  skills** → `MERGE.md` says to copy only the `crumb-*` directories, and
  `install-skills.ts` is additive, so a later `bun run install:skills` in the
  target never clobbers foreign skills.
- **The GitHub URL for `openspec/specs/` assumes the public repo path is stable**
  → it is the canonical published location; if the repo moves, that is a
  repo-wide link update, not specific to this feature.
- **Allowlist keeps growing and drifting** → the existing kit test enumerates
  the allowlist and asserts every entry exists; it is extended for `skills/`,
  `docs/`, and the installed-copy roots.
- **`extract.ts` now stages itself** → recursive only in the trivial sense; the
  staged copy is inert source, and a target that wants to re-seed a third
  project is a supported use of a complete template.
