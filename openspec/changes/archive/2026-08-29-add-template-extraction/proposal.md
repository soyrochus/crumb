## Why

Crumb is distributed as a repository you clone, not as a package. The documented
way to start is `git clone` followed by building your application in `src/app/`.
That works when Crumb is the root of a new project, but it offers no path for a
developer who already has a web application in its own repository and wants to
run it as a Crumb desktop app without moving that project into a Crumb clone.
Today they must manually identify which files are template-owned, copy them by
hand, and hope they neither missed one nor overwrote something of their own — and
then do the harder work of reshaping their project around the template with no
guidance.

## What Changes

- Add an `extract` command, run from a Crumb clone against an external target
  directory, that assembles every template-owned file needed to run Crumb into a
  single self-contained staging directory (`crumb-source/`) inside the target.
- The staging directory is inert: the script never writes outside it, never
  edits an existing file in the target, and never touches the Crumb clone it
  runs from. Applying the staged files into their final positions is a
  deliberate, developer-driven (or agent-assisted) step.
- The staged set covers the reusable kit, the build and development pipeline,
  the native binding patch, the release entry point, and the strict TypeScript
  configuration — the template's machinery only. It does not include the starter
  application, the worked examples, or any application-owned code.
- Files that a target must *merge* rather than adopt wholesale — dependency
  manifest entries and ignore rules — are delivered as fragments plus written
  instructions, never as drop-in replacements.
- Add an agent skill, `crumb-adopt-existing-project`, to the canonical `skills/`
  source (and therefore to every supported assistant's installed copies). It
  carries the judgement-heavy half of the job: run `extract`, then merge the
  staged files into an existing project — reconcile the manifest and TypeScript
  configuration, map the developer's existing interface into `src/app/`, adjust
  a framework build to a single server-less bundle entry, create the trimmed
  registry, and reach a running `bun run dev`.
- The script and the skill divide the work along a deliberate line: the script
  owns the mechanical, safety-critical, deterministic copy; the skill owns the
  per-project merge decisions the script must not guess at.
- The script reports exactly what it staged and what manual steps remain, and
  supports a preview mode that writes nothing.
- Document the extraction path in `README.md` and the how-to guide alongside the
  existing clone-based quick start.

## Capabilities

### New Capabilities

- `template-extraction`: How Crumb's template-owned machinery is extracted from a
  clone into an existing external project without modifying either the clone or
  the target's existing files; what the extracted set is guaranteed to contain
  and exclude; and the assistant skill that applies it into a project.

### Modified Capabilities

<!-- None. The ownership boundary in template-identity, the workflow guarantees
     in developer-workflow, and the skill-system guarantees in agent-skills are
     relied upon but not changed. The new skill is a new instance covered by the
     existing "Add a skill" scenario in agent-skills, not a change to its
     requirements. -->

## Impact

- New `scripts/extract.ts` (template-owned) and an `extract` entry in
  `package.json` `scripts`.
- New skill `skills/crumb-adopt-existing-project/SKILL.md` and its committed
  installed copies under `.claude/skills/`, `.codex/skills/`, `.github/skills/`.
- New capability spec `openspec/specs/template-extraction/spec.md` (created on
  archive from the delta in this change).
- Documentation: `README.md`, `docs/how-to-build-a-desktop-app-with-bun.md`.
- New kit test under `test/kit/` covering the staged file set and the
  no-overwrite / no-write-outside-staging guarantees.
- No change to the runtime, the bridge, the build pipeline output, or any
  produced executable. The script is repository tooling and the skill is
  repository material only.
