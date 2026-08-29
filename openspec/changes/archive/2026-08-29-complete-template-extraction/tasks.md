## 1. Broaden the allowlist

- [x] 1.1 Add `skills` (recursive) and `docs` (recursive) to `ALLOWLIST` in `scripts/extract.ts`
- [x] 1.2 Add the installed-copy roots: for `.claude/skills`, `.codex/skills`, `.github/skills`, stage every subdirectory whose name starts with `crumb-` (exclude `openspec-*` and any other non-Crumb skill)
- [x] 1.3 Shrink `SCRIPT_EXCLUSIONS` to `verify-readonly.ts` and `verify-performance.ts` only (stop excluding `extract.ts`, `install-skills.ts`, `feasibility.ts`)
- [x] 1.4 Add a `TEST_EXCLUSIONS` set for the `test/kit/` files that assert against the repository's own example registry (`application-registry.test.ts`, `build-time-selection.test.ts`, `native-extension-watch.test.ts`) so the staged kit tests pass against a trimmed registry
- [x] 1.5 Update `assertCrumbClone` / planned-file logic so the new roots are asserted and globbed correctly
- [x] 1.6 Confirm `bun run extract` output still stages nothing outside `crumb-source/`

## 2. Fragment and instructions

- [x] 2.1 Shrink `FRAGMENT_SCRIPT_EXCLUSIONS` to `verify:performance`, `verify:readonly` so `install:skills` returns to the `package.json` fragment
- [x] 2.2 Update the `MERGE_STEPS` / `mergeInstructions` output: apply the staged `skills/`, `docs/`, and `.claude|.codex|.github/skills/crumb-*` alongside the rest; correct any "installed by `bun run install:skills`" phrasing to reflect that extract stages them
- [x] 2.3 Add a `MERGE.md` note that `docs/` is Crumb's template documentation, not the target app's

## 3. Fix the shipped skills

- [x] 3.1 In every `skills/*/SKILL.md`, repoint the `openspec/specs/` reference from `../../openspec/specs/` to `https://github.com/soyrochus/crumb/tree/main/openspec/specs/`; leave the `docs/` links relative
- [x] 3.2 In `skills/crumb-adopt-existing-project/SKILL.md`, correct the "installed … by `bun run install:skills`" parenthetical to describe extract staging plus optional `install:skills` once the pipeline is applied
- [x] 3.3 Rework `skills/crumb-adopt-existing-project/SKILL.md` into a decision procedure: assess feasibility (client-side UI, single bundle, backend can move to host, supported platform), then apply / propose migration / decline; resolve script-name collisions explicitly; verify the applied tree; never half-apply
- [x] 3.4 Run `bun run install:skills` to regenerate the committed copies; confirm `bun run install:skills --check` passes

## 4. Docs

- [x] 4.1 Update the README "Bring Crumb into an existing project" section to state the decoupling guarantee (every Crumb command, skill, and referenced doc works in the target) and that `bun run install:skills` works there
- [x] 4.2 Update the how-to `### Start from an existing project instead` section correspondingly

## 5. Spec Purpose

- [x] 5.1 After the delta is drafted, set `openspec/specs/template-extraction/spec.md` `Purpose` (currently the `TBD` placeholder from the 2026-08-29 archive) to a real one-paragraph purpose

## 6. Tests

- [x] 6.1 Extend `test/kit/extract.test.ts`: allowlist now includes `skills/`, `docs/`, and the `crumb-` installed-copy roots; still excludes `examples/`, `verify-readonly.ts`, `verify-performance.ts`
- [x] 6.2 Assert the staged set contains `skills/crumb-adopt-existing-project/SKILL.md`, `docs/how-to-build-a-desktop-app-with-bun.md`, and `.claude/skills/crumb-add-operation/SKILL.md`, and contains no `openspec-*` skill copy
- [x] 6.3 Assert the `package.json` fragment `scripts` now contains `install:skills` and still omits `verify:readonly` / `verify:performance`
- [x] 6.4 Assert no `skills/*/SKILL.md` staged content contains the relative string `../../openspec/specs/`
- [x] 6.5 Assert the registry-coupled `test/kit/` files are not in the planned set
- [x] 6.6 Run `bun test` and `bun run typecheck`

## 7. End-to-end check

- [x] 7.1 Extract into a throwaway directory, apply the fragments and staged tree by hand (or with the skill), and confirm `bun run install:skills --check`, `bun run typecheck`, and `bun test` succeed there with the source clone moved aside or unavailable
