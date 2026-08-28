## Context

The repository already contains a worked instance of the problem this change addresses. The OpenSpec CLI installs its four skills into `.claude/skills/`, `.codex/skills/`, and `.github/skills/` as byte-identical copies — verified identical by directory comparison — and separately emits a *command* layer whose files genuinely differ per vendor: `.claude/commands/opsx/propose.md` carries `name`, `description`, `category`, and `tags`, while `.github/prompts/opsx-propose.prompt.md` carries only `description` and encodes its name in the filename.

That split is the central fact for this design. **Skills are copy-identical across all three targets; commands are not.** Restricting this change to skills is what keeps the installer a file copier rather than a per-vendor code generator, and it is why the command layer is excluded from scope rather than deferred for convenience.

The material the skills must carry already exists as prose in [`docs/how-to-build-a-desktop-app-with-bun.md`](../../../docs/how-to-build-a-desktop-app-with-bun.md) and as normative requirements under `openspec/specs/`. This change does not discover anything about Crumb; it re-forms known material into a shape an assistant encounters at the moment of the task rather than a document it may never open.

## Goals / Non-Goals

**Goals:**

- One canonical, vendor-neutral definition of each skill, with every installed copy derived from it mechanically.
- Installation and verification as ordinary repository commands, consistent with how every other Crumb tool is invoked.
- Coexistence with the OpenSpec CLI in the same three directories, with neither tool disturbing the other's files.
- Skills that a cloner inherits and can install in one command, without first learning which assistant reads which directory.

**Non-Goals:**

- The per-vendor command and prompt layer. It requires real per-vendor emission and is a separate decision.
- Uninstallation, migration of existing hand-written skills, or reconciliation of skills a developer added themselves.
- Any assistant beyond the three named. The design keeps the target list in one place so adding a fourth is a data change, but adding one is not part of this change.
- A repository-root assistant instruction file. That is a different artifact with a different lifecycle, and the whole premise of this change is that Crumb's guidance should not be vendor-shaped.

## Decisions

### `skills/` at the repository root as the canonical source

Each skill is `skills/<name>/SKILL.md`. The directory sits at the root rather than under `docs/` or `src/kit/` because it is neither documentation prose nor template runtime code: it is material the installer treats as data, and a cloner should find it without being told where to look.

*Alternatives considered.* Keeping one vendor's directory as canonical and copying from it — rejected, because it makes Crumb's guidance nominally the property of one assistant and re-creates exactly the framing this change exists to remove. Generating skills from the documentation — rejected as far more machinery than three files justify, and it would tie skill structure to prose structure, which is the wrong coupling.

### `SKILL.md` with YAML frontmatter as the single format

All three targets read this format unmodified here today, so "vendor-neutral" costs nothing and needs no translation step. The frontmatter carries `name` and `description`; the `description` is what an assistant matches against a task, so it states the trigger condition, not just the topic.

*Alternative considered.* A neutral intermediate format compiled to a per-vendor output — rejected as machinery for a difference that does not currently exist. If a fourth target ever needs a different shape, a translation step can be introduced then, in one place, with real requirements to satisfy.

### A `crumb-` prefix on every skill name

Skills install into directories shared with another tool's output. A prefix gives collision-free names and — more importantly — makes ownership legible in the installed tree: a developer looking at `.claude/skills/` can tell at a glance which directories came from Crumb.

### The installer is a Bun script, not a standalone executable

`scripts/install-skills.ts`, exposed as `bun run install:skills`, matching every other tool in the repository (`dev`, `build`, `verify:readonly`, `rebuild:extensions`). A shell executable would add a second language, a shebang, and an executable bit to a repository that currently has none of those, for a task that is directory traversal and file copying.

*Alternative considered.* A standalone `install-skills` executable, as originally sketched — rejected on consistency grounds. Bun is already required to do anything with this repository, so it is not an added dependency.

### Copy, never symlink

Symlinks would make drift structurally impossible, which is genuinely attractive. They are rejected because the copies are committed and must be real files for a cloner who has not run the installer, and because symlinked skills break when a directory is vendored, archived, or copied out of the repository. Copying accepts drift as a real failure mode and answers it with `--check` instead.

### Installed copies are committed

Consistent with how the OpenSpec skills are handled today, and necessary so that a fresh clone works with an assistant before anyone runs an installer. The cost is drift, which the check exists to catch.

### Ownership is the set of directory names under `skills/`

The installer writes, replaces, and checks exactly the skill names the canonical source contains, and touches nothing else. This needs no manifest file, no ownership marker written into the target tree, and no record of past installs: the source is the manifest. A skill removed from `skills/` is therefore left behind in the target directories rather than deleted — deliberate, because deleting files in a shared directory based on their absence is how two tools destroy each other's output.

### `--check` verifies, `--force` is unnecessary

`--check` compares every installed copy against its source, reports every stale or missing one, and exits non-zero without writing. A plain run always overwrites the copies it owns, so there is no state in which a `--force` flag would do anything a plain run does not — it is dropped from the earlier sketch. `--target=<assistant>` narrows the run; `--list` prints what would be written and exits.

### Target layout lives in one table

The three target directories appear once, as data. Adding an assistant is one entry.

## Risks / Trade-offs

- **Committed copies drift from their source.** → `--check` detects it and fails loudly. It is not wired into the release workflow in this change, because `developer-workflow`'s verification requirement enumerates what a run covers and extending that list is an amendment, not an implementation detail. Until then the check is a documented local command.

- **Skills duplicate documentation, and duplication rots silently.** No mechanism can verify that a skill still describes the template truthfully. → Mitigated editorially: skills carry the ceremony, the file list, and the invariants — the parts that change only when the template's structure changes — and reference `docs/` and `openspec/specs/` for everything else. The specification governs on any disagreement, which makes the resolution rule explicit rather than a judgment call.

- **Two tools writing one directory tree.** The OpenSpec CLI may reorganize or clean the directories it manages. → The installer never deletes what it did not install, and prefixed names keep the two sets distinct. If the other tool ever removes foreign directories, the recovery is one `bun run install:skills`.

- **An assistant may trust a skill over a specification.** A skill is closer to hand and shorter than the specification it summarizes, which is precisely why it might win an argument it should lose. → The subordination requirement is normative, and each skill states its own authority explicitly rather than leaving precedence implicit.

- **Vendor directory conventions can change.** Any of the three assistants may move or restructure where it looks for skills. → The layout is data in one table; a move is one edit plus a reinstall.

- **Three skills may be the wrong three.** They are chosen from where the template's own ceremonies are most breakable, not from evidence about where cloners actually fail — the template has no such evidence yet. → Accepted deliberately. Adding a fourth skill is cheap once the source and installer exist, and this change is structured so that the mechanism, not the initial content, is the durable part.

## Open Questions

- Should the `--check` mode be wired into the release verification workflow, accepting the `developer-workflow` amendment that requires? It is cheap — no compilation — and drift is the predictable failure of committed copies. Deferred rather than decided, so this change stays scoped to skills.
- Does the command and prompt layer earn its per-vendor emission? Worth revisiting once the skills have been used enough to show whether an explicitly invoked command adds anything over a skill an assistant selects on its own.
