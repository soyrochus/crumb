## Context

Two prior changes built `template-extraction`: `add-template-extraction` (the
`extract` command and the `crumb-adopt-existing-project` skill) and
`complete-template-extraction` (self-contained extract; the skill reworked into
an assess → apply / propose / decline decision procedure).

Both left the same hole. `extract`'s core safety guarantee is "writes only into
`<dest>/crumb-source/`, never the clone, never an existing target file". The
`crumb-adopt-existing-project` skill is the tool that applies `crumb-source/`.
But the skill only reaches an assistant through an assistant skill directory
(`.claude/skills/`, …), and `extract` puts the skill in `crumb-source/`, not
there. `bun run install:skills` would place it, but that command does not exist
in the target until the merge — the very task — is done.

`scripts/install-skills.ts` already exports `discoverSkills(root)` and
`installSkills(skills, assistants, repositoryRoot)`. `installSkills` writes each
`skills/<name>/` into `resolve(repositoryRoot, assistant.directory, <name>)` and
is, per the `agent-skills` spec, "additive and bounded to what the template
owns": it creates or replaces only the discovered skill names and never reads,
moves, or removes anything else in a target directory. Passing `<dest>` as
`repositoryRoot` installs the Crumb skills into `<dest>/.claude/skills/` etc.
with those same guarantees.

## Goals / Non-Goals

**Goals:**

- After `bun run extract -- --dest <project>`, an assistant opened in
  `<project>` can invoke `crumb-adopt-existing-project` immediately, with no
  prior manual step.
- The end-to-end flow is two steps: extract, then one assistant task.
- The install is as safe as `bun run install:skills`: additive, `crumb-`
  namespaced, never touches other files.

**Non-Goals:**

- `extract` running the merge itself. The merge is per-project judgement and
  stays the skill's job.
- `extract` writing anything else outside `crumb-source/`. The skill install is
  the only exception, and it is bounded.
- Removing the staged skill copies from `crumb-source/`. `crumb-source/` stays
  self-contained; the direct install is an additional bootstrap, not a
  replacement.
- Changing `bun run install:skills` — it is still the one command a Crumb repo
  uses, and it is what the target uses after the merge.

## Decisions

### Decision: `extract` installs the Crumb skills into `<dest>`

After staging `crumb-source/` and before printing the summary, when not
`--dry-run`:

```ts
import { discoverSkills, installSkills, SUPPORTED_ASSISTANTS } from "./install-skills";

const skills = await discoverSkills(root);           // the clone's skills/
const installed = await installSkills(skills, SUPPORTED_ASSISTANTS, destReal);
```

`installed` entries (`created` / `replaced` / `unchanged` / `removed`, each with
a repo-relative path like `.claude/skills/crumb-adopt-existing-project/SKILL.md`)
are reported in the command output, separately from the `crumb-source/` staging
list.

Under `--dry-run`, the command computes and reports the same set via
`listSkills(skills, SUPPORTED_ASSISTANTS)` but installs nothing.

### Decision: The safety guarantee is narrowed, not dropped

`extract` still:

- never writes inside the clone,
- refuses a `<dest>` inside the clone,
- writes nothing outside `<dest>/crumb-source/` **except** the additive skill
  install into `<dest>/.claude/skills/`, `<dest>/.codex/skills/`,
  `<dest>/.github/skills/`, which creates or replaces only `crumb-` skill
  directories and never modifies or removes any other file.

`installSkills` already enforces the "only owned skill names" boundary and the
`agent-skills` tests cover it, so the extract test only needs to confirm the
files land and a foreign skill beside them is untouched.

An existing `crumb-adopt-existing-project` (or other `crumb-` skill) in the
target is replaced with the clone's copy — the same "reinstall restores the
source" behavior `bun run install:skills` has. That is desirable: the target
gets the skill version matching the extract.

### Decision: Two-step flow in the instructions

`MERGE.md` opens with:

1. `bun run extract -- --dest <project>` — done (this file exists because it
   ran); it also installed the Crumb skills for your assistant.
2. Open your coding assistant in this project and ask it to adopt Crumb. It runs
   the `crumb-adopt-existing-project` skill, which assesses the project and then
   applies `crumb-source/` (or proposes a migration, or explains why it will not
   fit).

The manual checklist stays in `MERGE.md` below that, for a developer doing it
without an assistant.

The `crumb-adopt-existing-project` skill's Step 1 changes from "run extract from
a Crumb clone" to "you are running because the extract installed you; if
`crumb-source/` is missing, have the developer run `bun run extract` from a
clone first".

## Risks / Trade-offs

- **`extract` now writes outside `crumb-source/`** → bounded to additive
  `crumb-` skill directories via the audited installer; reported in the output;
  documented as the one exception. The protection that matters — no existing
  file modified or deleted, clone untouched — holds.
- **A target with no assistant directories** → `installSkills` creates
  `.claude/skills/` etc. as needed (same as `bun run install:skills` in a fresh
  repo). A target that uses none of the three assistants gets three small
  unused directories; `MERGE.md` notes they can be deleted.
- **Skill version skew** → the installed skill always matches the clone the
  extract ran from; re-running `extract` refreshes it, and `MERGE.md` records
  the Crumb version.
- **Redundancy with the staged copies in `crumb-source/`** → intentional;
  `crumb-source/` stays self-contained for a manual apply while the direct
  install unblocks the assistant path.
