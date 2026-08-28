## Why

Crumb is a template you clone, and the work a cloner does first — declare an operation, add a native extension, register a second application — is exactly the work that is easy to do *almost* right. The operation ceremony spans four files that must agree, and its most skippable step, the runtime validator, is the one that is actually a security boundary. The Content Security Policy is declared twice, in two forms, and changing one without the other produces an application that works in development and breaks on release. [`docs/how-to-build-a-desktop-app-with-bun.md`](../../../docs/how-to-build-a-desktop-app-with-bun.md) explains all of this well, to a reader who reads it first.

Coding assistants are now a normal part of that first hour, and they do not reliably read the document first. A skill is the form this knowledge has to take to reach them. The repository already demonstrates the distribution problem it creates: the four OpenSpec skills exist as byte-identical copies in `.claude/skills/`, `.codex/skills/`, and `.github/skills/`, maintained by an external tool. Crumb should not add a second set of triplicated files, and should not present its own guidance as an accessory to one vendor's assistant.

## What Changes

- **A vendor-neutral `skills/` directory** at the repository root, the single source of truth for Crumb's own agent skills. Each skill is a directory containing `SKILL.md` with YAML frontmatter — the format all three target assistants already read unmodified in this repository. Nothing under `skills/` names a vendor.
- **Three skills**, covering the tasks where reading the documentation and still getting it wrong is most likely:
  - *Adding a validated host operation* — the shared contract, the runtime validator, the host handler, the entry in `operations`, and the typed `invoke` call site, as one indivisible ceremony, with the reason the validator is not optional.
  - *Adding a Rust native extension* — the `cdylib` crate shape, the Node-API module initializer, the macOS `dynamic_lookup` link arguments, the committed `Cargo.lock` that `--locked` requires, the logical-name rules, the prohibition on artifact paths in configuration, and the trust boundary that `verify:readonly` does not cover.
  - *Scaffolding a new registered application* — the `src/app/` shape, its `ApplicationConfig`, the registry entry, the `--example=<name>` selection flag, and the dual-CSP invariant.
- **An installer**, `scripts/install-skills.ts`, exposed as `bun run install:skills`. It copies every skill in `skills/` into the layout each supported assistant reads: `.claude/skills/`, `.codex/skills/`, and `.github/skills/`. It installs only what `skills/` contains, leaving the OpenSpec-generated skills beside it untouched.
- **A drift check**, `bun run install:skills --check`, reporting any installed copy that differs from its source and exiting non-zero. Installed copies are committed, so they can go stale; the check is what makes committing them safe.
- **Documentation** presenting `skills/` as template-owned material a cloner inherits, and stating plainly that a skill is a shortcut to the documented workflow, not a second, divergent specification of it.

**Not in scope:** the per-vendor command and prompt layer — `.claude/commands/`, `.github/prompts/` — where the three targets stop being copy-identical and each needs its own frontmatter and filename shape. Skills alone are copy-identical across all three, which is what makes this change small; commands are a separate decision with a real per-vendor implementation behind it. Also out of scope: a repository-root assistant instruction file (the `CLAUDE.md` genre), skills for contributing *to* Crumb rather than building *on* it, wiring the drift check into the release workflow, and any assistant beyond the three named.

## Capabilities

### New Capabilities

- `agent-skills`: What the template promises about the guidance it ships for coding assistants — that a canonical vendor-neutral source exists, that installing it is one command and additive rather than destructive, that installed copies are verifiable against their source, and that a skill never becomes an authority competing with the documentation and specifications it summarizes.

### Modified Capabilities

None. `template-identity` already requires every artifact to be classifiable as template-owned or application-owned, and `skills/` is template-owned under that existing rule. `developer-workflow` enumerates no command surface that adding one script would contradict. Its `Automated release verification` requirement does name what a verification run covers, and adding the drift check to that list would be a genuine amendment — which is why wiring it into the release workflow is deliberately excluded above rather than smuggled in. If authoring the skills exposes a template promise that is wrong rather than merely undocumented, that is a finding worth raising as an amendment.

## Impact

- **New files**: `skills/<name>/SKILL.md` for three skills, `scripts/install-skills.ts`, one `package.json` script entry, and the generated copies under `.claude/skills/`, `.codex/skills/`, and `.github/skills/`.
- **Committed generated copies.** They must be committed, because a cloner who has not yet run the installer should still find the skills where their assistant looks. That is what makes them capable of drifting, and why `--check` is part of this change rather than a refinement of it.
- **Collision with the OpenSpec CLI.** That tool writes into the same three directories. The installer must be scoped to names it owns and must never remove or rewrite a directory it did not install, or the two tools will fight over the same tree.
- **Skills duplicate documentation, and duplication rots.** Every fact a skill states is a fact that can fall out of step with `docs/`, `openspec/specs/`, and the code. The mitigation is editorial, not mechanical: skills state the ceremony and the invariants, and point to the documentation for everything else rather than restating it.
- **Runtime and distribution**: none. No change to the host, the kit, the bridge, the build pipeline, or any produced executable. `skills/` is repository material and is not embedded in a release artifact.
- **Tests**: the installer's copy, target-layout, and drift-detection behavior are testable without an assistant present. The skills' content is verified by review against the documentation they summarize.
