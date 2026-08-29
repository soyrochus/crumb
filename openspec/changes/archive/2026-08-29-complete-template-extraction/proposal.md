## Why

The `template-extraction` capability shipped with a staged set scoped to "the
template machinery only" — the kit, the build pipeline, the native patch,
`main.ts`, `tsconfig.json`. That scoping was too narrow. It leaves the
destination coupled to the source clone: the Crumb skills are not there, the
`install:skills` command is deliberately withheld, and the skills that are
installed from the clone cite `docs/` and `openspec/specs/` paths that do not
exist in the target. Running `bun run install:skills` in a freshly extracted
project fails outright.

The intent of `extract` is the opposite: the destination should be a complete,
locally-functioning Crumb template, fully decoupled from the clone it came from.
Every documented Crumb command, every shipped skill, and every document a skill
points at should work in the target with no reference back to the source.

## What Changes

- Broaden the extract allowlist so the destination is self-contained:
  - add `skills/` (the canonical, vendor-neutral skill source and its README);
  - add `docs/` (the how-to and build/runtime/verification guides the skills
    cite);
  - add the committed installed skill copies for the `crumb-` skills under
    `.claude/skills/`, `.codex/skills/`, and `.github/skills/`, so the target
    works with an assistant before anything is run there;
  - stop excluding `scripts/install-skills.ts`, `scripts/extract.ts`, and
    `scripts/feasibility.ts` — each is template-owned and self-contained.
- Restore `install:skills` to the `package.json` fragment's `scripts`.
- Keep `examples/` and the `verify:readonly` / `verify:performance` scripts out:
  the examples are worked demo applications, application-owned per
  `template-identity`, and the verify scripts import from
  `examples/file-explorer/`. Record that boundary in the spec.
- Repoint the `openspec/specs/` citation in every shipped Crumb skill from a
  clone-relative path to the canonical Crumb repository URL, since the relative
  path already does not resolve from an installed skill copy and cannot resolve
  in a target project that has its own planning home. Keep `docs/` links
  relative, because `docs/` now travels with the extract.
- Fix the `crumb-adopt-existing-project` skill and `MERGE.md` wording that says
  the skill is "installed by `bun run install:skills`": in an extracted project
  it is staged by `bun run extract` and copied into place from `crumb-source/`.
- Rework the `crumb-adopt-existing-project` skill so it is a decision procedure,
  not a checklist: an assistant assesses whether the project (typically an
  existing Node app) can become a Crumb application, then explicitly applies,
  proposes a staged migration for approval, or declines with a named blocker —
  and never leaves a half-merged `package.json` or a project that will not
  build. Script-name collisions (`dev`, `build`, `test`, `start`) are resolved
  and reported, not silently dropped or doubled.
- Update `README.md` and the how-to so the extraction section states the
  decoupling guarantee.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `template-extraction`: the "Staged set is the template machinery only"
  requirement is replaced by a requirement that the staged set make the target a
  self-contained Crumb template — the kit, the full pipeline, the skills, and the
  documentation the skills reference — with `examples/` and example-only checks
  named as the deliberate exclusions. A new requirement states the decoupling
  guarantee: after applying, every documented Crumb command works in the target
  with no reference to the source clone. The "An assistant skill applies the
  extracted files into a project" requirement is modified so the skill assesses
  feasibility first and must apply, propose a migration, or decline — never
  half-apply. The fragment/instructions requirement is amended for the staged
  skills and the restored `install:skills` script.
`agent-skills` is **not** modified: repointing a skill's external reference from a
clone-relative path to the canonical repository URL is exactly what its "Skills
are subordinate to the documentation and specifications" requirement already asks
for ("SHALL point to the authoritative document"). The installed skill copies are
regenerated, but no `agent-skills` requirement text changes.

## Impact

- `scripts/extract.ts`: allowlist additions, exclusion removals, installed-copy
  globbing for `crumb-` skills, fragment `scripts` change.
- `skills/*/SKILL.md` (all four): `openspec/specs/` link repointed; regenerated
  installed copies under `.claude/skills/`, `.codex/skills/`, `.github/skills/`.
- `skills/crumb-adopt-existing-project/SKILL.md` and the `MERGE.md` generator:
  wording fix.
- `openspec/specs/template-extraction/spec.md`: delta applied on archive; also
  fill in the `Purpose` placeholder left by the previous archive.
- `test/kit/extract.test.ts`: assertions for the broadened set and the
  decoupling guarantee.
- `README.md`, `docs/how-to-build-a-desktop-app-with-bun.md`: wording.
- No change to the runtime, the bridge, the build pipeline output, or any
  produced executable.
