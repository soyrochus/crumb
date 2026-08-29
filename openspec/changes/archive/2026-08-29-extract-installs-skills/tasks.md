## 1. Install the skills during extract

- [x] 1.1 In `scripts/extract.ts`, import `discoverSkills`, `installSkills`, `listSkills`, `SUPPORTED_ASSISTANTS` from `./install-skills`
- [x] 1.2 After staging `crumb-source/` (not under `--dry-run`), run `installSkills(await discoverSkills(root), SUPPORTED_ASSISTANTS, destReal)` and collect the entries
- [x] 1.3 Under `--dry-run`, compute the same set with `listSkills` and report it without installing
- [x] 1.4 Report the skill install as its own section in the command output ("Installed N skill file(s) into <dest>/.claude/skills, .codex/skills, .github/skills"), separate from the staging list and count summary
- [x] 1.5 Keep the clone-safety guards intact; confirm the only writes outside `crumb-source/` are `<dest>/.{claude,codex,github}/skills/crumb-*`

## 2. Instructions and skill wording

- [x] 2.1 Rewrite the head of `mergeInstructions` in `scripts/extract.ts`: primary path is "open an assistant in this project and have it adopt Crumb — the extract already installed the skill"; keep the numbered manual checklist below it
- [x] 2.2 Add a `MERGE.md` note that the `.{claude,codex,github}/skills/` directories were created by the extract and hold only Crumb's `crumb-` skills
- [x] 2.3 In `skills/crumb-adopt-existing-project/SKILL.md`, change Step 1 from "run extract from a Crumb clone" to "you are running because the extract installed you; if `crumb-source/` is absent, have the developer run `bun run extract` from a clone first"
- [x] 2.4 Run `bun run install:skills`; confirm `bun run install:skills --check` passes

## 3. Docs

- [x] 3.1 Update the README "Bring Crumb into an existing project" section to the two-step flow (extract installs the skill; then ask an assistant to adopt)
- [x] 3.2 Update the how-to `### Start from an existing project instead` section correspondingly

## 4. Tests

- [x] 4.1 Extend `test/kit/extract.test.ts`: after `runExtract` into a temp target, `<dest>/.claude/skills/crumb-adopt-existing-project/SKILL.md`, `<dest>/.codex/skills/...`, and `<dest>/.github/skills/...` exist
- [x] 4.2 Assert a pre-existing non-Crumb skill in `<dest>/.claude/skills/` is left byte-for-byte unchanged
- [x] 4.3 Assert `--dry-run` installs no skill files into `<dest>` and still reports them
- [x] 4.4 Assert the command output has a distinct skill-install section
- [x] 4.5 Assert `runExtract` still writes nothing into the clone and nothing outside `<dest>/crumb-source/` and `<dest>/.{claude,codex,github}/skills/`
- [x] 4.6 Run `bun test` and `bun run typecheck`

## 5. End-to-end check

- [x] 5.1 Extract into a throwaway directory that has no assistant directories; confirm the Crumb skills are installed under it and `crumb-source/` is staged, with the source clone otherwise untouched
