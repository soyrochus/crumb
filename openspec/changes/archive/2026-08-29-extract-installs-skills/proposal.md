## Why

`template-extraction` has a bootstrapping hole. The `crumb-adopt-existing-project`
skill is what turns an extracted `crumb-source/` into a running Crumb
application, but there is no way to get that skill in front of an assistant
working in the target project without first doing the merge by hand:

- `extract` stages the skill inside `crumb-source/skills/` and
  `crumb-source/.claude/skills/`, not where an assistant reads it.
- `bun run install:skills` does not exist in the target until its `package.json`
  and `scripts/` have been merged — which is the work the skill exists to do.

So the documented flow is "run extract, then manually apply half of it, then the
skill can help with the rest." That defeats the point of shipping the skill. In
practice a developer runs `bun run extract`, then `bun run install:skills`, gets
`Script not found`, and is stuck.

## What Changes

- `bun run extract` SHALL install the Crumb assistant skills directly into the
  target's assistant skill directories (`<dest>/.claude/skills/`,
  `<dest>/.codex/skills/`, `<dest>/.github/skills/`) as part of extraction, using
  the same additive installer `bun run install:skills` uses.
- This is a narrow, named exception to "extract writes only into
  `crumb-source/`": it creates or replaces only the template's own `crumb-`
  skills and never modifies or removes any other file, including skills another
  tool installed. It still never writes inside the clone.
- `--dry-run` reports the skill installation without performing it.
- `MERGE.md`, the `crumb-adopt-existing-project` skill, and the docs are updated
  to the two-step flow: (1) `bun run extract -- --dest <project>` from a clone,
  (2) open an assistant in the project and ask it to adopt Crumb — the skill is
  already there and does the merge.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `template-extraction`: the "No modification of the clone or of existing target
  files" requirement is amended to permit the additive install of the Crumb
  `crumb-` skills into the target's assistant directories. A new requirement
  states the two-step bootstrap guarantee: after `extract`, an assistant opened
  in the target can use `crumb-adopt-existing-project` with no prior manual step.
  The fragment/instructions and assistant-skill requirements are amended for the
  new flow.

<!-- agent-skills is not modified: extract reuses the additive, template-owned-
     only installer, which is exactly what that capability already guarantees.
     `bun run install:skills` remains the one documented install command. -->

## Impact

- `scripts/extract.ts`: import and run the `install-skills.ts` install logic
  against `<dest>`; report it; skip under `--dry-run`.
- `scripts/extract.ts` `MERGE.md` generator: two-step flow wording.
- `skills/crumb-adopt-existing-project/SKILL.md`: Step 1 acknowledges the skill
  is already installed by the extract; regenerated installed copies.
- `openspec/specs/template-extraction/spec.md`: delta applied on archive.
- `test/kit/extract.test.ts`: assert the skills land in `<dest>/.claude/skills/`
  etc., that non-Crumb skills there are untouched, and that `--dry-run` installs
  nothing.
- `README.md`, `docs/how-to-build-a-desktop-app-with-bun.md`: two-step flow.
- No change to the runtime, the bridge, the build pipeline output, or any
  produced executable.
