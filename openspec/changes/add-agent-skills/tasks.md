## 1. Canonical source and target layout

- [ ] 1.1 Create `skills/` at the repository root with a `README.md` stating that it is the canonical, template-owned source, that installed copies are generated, and that edits belong here rather than in an assistant's directory
- [ ] 1.2 Define the supported-assistant table in `scripts/install-skills.ts` as data — assistant key and target directory for Claude (`.claude/skills/`), Codex (`.codex/skills/`), and Copilot (`.github/skills/`) — so adding an assistant is one entry
- [ ] 1.3 Fix the skill frontmatter convention: `name` and `description`, with `description` stating the trigger condition rather than the topic, and record it in `skills/README.md`

## 2. Installer

- [ ] 2.1 Implement discovery: enumerate `skills/<name>/` directories as the ownership set, and fail with a clear diagnostic on a directory missing `SKILL.md`
- [ ] 2.2 Implement the default run: copy every discovered skill into every supported assistant's directory, creating target directories that do not exist, and report each path written
- [ ] 2.3 Implement `--target=<assistant>`: write only the named assistant, leave the others untouched, and fail listing the supported assistants when the name is unknown
- [ ] 2.4 Implement `--list`: print the skills and the paths a run would write, then exit without writing
- [ ] 2.5 Implement `--check`: compare every installed copy against its source, report each missing or differing copy, exit non-zero on any difference, and write nothing in this mode
- [ ] 2.6 Enforce the ownership boundary: never delete, rewrite, or reorganize a path outside the discovered skill names, including skills present in a target directory that `skills/` does not contain
- [ ] 2.7 Register `install:skills` in `package.json` scripts

## 3. Installer tests

- [ ] 3.1 Test that a default run installs every skill into all three target layouts
- [ ] 3.2 Test that `--target` writes one assistant and leaves the other target directories byte-for-byte unchanged
- [ ] 3.3 Test coexistence: a target directory holding foreign skills (as the OpenSpec CLI produces) is left unchanged, and a skill absent from `skills/` is left in place rather than deleted
- [ ] 3.4 Test that reinstalling restores an edited installed copy to match its source and reports the replacement
- [ ] 3.5 Test `--check` succeeding when copies are in sync, and failing with a non-zero exit and a per-file report when a source is edited, a copy is edited, or a copy is missing
- [ ] 3.6 Test that an unknown `--target` value fails, lists the supported assistants, and writes nothing

## 4. Skill: add a validated host operation

- [ ] 4.1 Write `skills/crumb-add-operation/SKILL.md` covering the ceremony as indivisible: shared contract, runtime validator, host handler, `operations` entry, and the typed `invoke` call site
- [ ] 4.2 State why the validator is a security boundary and not a type-level convenience, and that the host does not run a handler whose validator rejected its input
- [ ] 4.3 Record the validator conventions the template expects: reject unexpected keys, bound strings, arrays, and read sizes, and normalize paths with the kit's path helper
- [ ] 4.4 State the return-value boundary — serializable data only, no functions, DOM objects, or process-local values — and reference `docs/how-to-build-a-desktop-app-with-bun.md` for everything beyond the ceremony

## 5. Skill: add a Rust native extension

- [ ] 5.1 Write `skills/crumb-add-native-extension/SKILL.md` covering the crate shape: `crate-type = ["cdylib"]`, the Node-API module initializer without which Bun cannot import the artifact, and the macOS-only `dynamic_lookup` link arguments in `build.rs`
- [ ] 5.2 Cover the declaration rules: logical name to source directory in `nativeExtensions`, name character rules, and the prohibition on artifact paths, platform suffixes, and build outputs in configuration
- [ ] 5.3 Cover the committed `Cargo.lock` that `--locked` requires, and the `rebuild:extensions` command as a forced-rebuild diagnostic rather than a routine step
- [ ] 5.4 State the trust boundary: an extension runs with the host process's full permissions, `verify:readonly` scans TypeScript only and makes no claim about Rust, and native work must neither block the window's event loop nor outlive it without a registered shutdown handler
- [ ] 5.5 State that the WebView never reaches native code directly — only through a declared, validated operation

## 6. Skill: scaffold a new registered application

- [ ] 6.1 Write `skills/crumb-new-application/SKILL.md` covering the `src/app/` directory shape, the `ApplicationConfig`, and the registry entry in the repository-level `app.config.ts`
- [ ] 6.2 Cover selection with `--example=<name>` across `dev`, `build`, and `rebuild:extensions`, and that a registered application is a first-class build target rather than copied-in source
- [ ] 6.3 State the dual-CSP invariant explicitly: `'self'` in the source document, `'unsafe-inline'` in the application configuration, the reason the two differ, and that changing one without the other builds an application that works in development and breaks on release
- [ ] 6.4 State the ownership boundary — `src/app/` is yours, `src/kit/` is the template's and a normal application does not modify it

## 7. Editorial pass and documentation

- [ ] 7.1 Verify every skill against `docs/how-to-build-a-desktop-app-with-bun.md` and the specifications under `openspec/specs/`, correcting the skill wherever the two disagree
- [ ] 7.2 Cut from each skill anything that can be referenced instead of restated, leaving the ceremony, the file list, and the invariants
- [ ] 7.3 Give each skill an explicit statement that the documentation and specifications govern where they disagree with it
- [ ] 7.4 Document `skills/` and `bun run install:skills` in `README.md` and in the how-to guide, presenting skills as a shortcut to the documented workflow rather than a substitute for it, and naming what the installer does not touch

## 8. Verification

- [ ] 8.1 Run the installer, confirm the three target directories contain the Crumb skills alongside the untouched OpenSpec skills, and commit the generated copies
- [ ] 8.2 Confirm `bun run install:skills --check` passes on the committed tree, and fails as specified after editing one source file
- [ ] 8.3 Run `bun test` and `bun run typecheck`
- [ ] 8.4 Confirm no runtime impact: build an application before and after installation and confirm the executable is unaffected and contains no skill content
- [ ] 8.5 Exercise each skill end to end with an assistant on a scratch application — declare an operation, add an extension, register an application — and correct any step that produced a partially correct result
