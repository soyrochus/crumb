## 1. Allowlist and repo assertion

- [x] 1.1 Define the template-owned allowlist in `scripts/extract.ts` as an explicit list of path roots (recursive dirs and single files) per design.md
- [x] 1.2 Implement a clone check that asserts every allowlisted path exists; fail with a message naming the first missing path
- [x] 1.3 Implement the per-script exclusion set within `scripts/` (`extract.ts`, `verify-readonly.ts`, `verify-performance.ts`, `feasibility.ts`, `install-skills.ts`)

## 2. Argument handling and safety guards

- [x] 2.1 Parse `--dest` (required), `--dry-run`, `--force`; print usage on missing/invalid args and exit non-zero
- [x] 2.2 Resolve `--dest` to an absolute real path; fail if it is not an existing directory
- [x] 2.3 Refuse to run when the resolved `--dest` is the Crumb clone root or nested inside it
- [x] 2.4 Fail when `<dest>/crumb-source/` exists and is non-empty unless `--force` is given

## 3. Staging

- [x] 3.1 Copy each allowlisted path into `<dest>/crumb-source/` preserving relative layout; never write outside that directory
- [x] 3.2 Under `--force`, overwrite only paths the allowlist produces; leave unknown files in `crumb-source/` untouched
- [x] 3.3 Under `--dry-run`, compute the full plan and write nothing

## 4. Fragments and merge instructions

- [x] 4.1 Write `crumb-source/fragments/package.json` containing only the `scripts`, `dependencies`, and `devDependencies` keys Crumb requires
- [x] 4.2 Write `crumb-source/fragments/gitignore` with `node_modules/`, `dist/`, `.build/`
- [x] 4.3 Write `crumb-source/fragments/app.config.ts` with a trimmed single-app registry (`default: "starter"`, `applications: { starter }`)
- [x] 4.4 Generate `crumb-source/MERGE.md` with ordered steps (apply staged files, merge manifest fragment, merge gitignore, place registry, add `src/app/` interface), each noting the symptom of skipping it, and a pointer to the `crumb-adopt-existing-project` skill
- [x] 4.5 Record the source Crumb `package.json` version and current git SHA in `MERGE.md`

## 5. Output manifest

- [x] 5.1 Print each staged path with a copied / would-copy / skipped marker and a count summary
- [x] 5.2 Echo the ordered `MERGE.md` steps as "next steps" on stdout
- [x] 5.3 Exit non-zero on any error path; ensure no partial `crumb-source/` is left in an ambiguous state (or clearly report what was written)

## 6. Assistant skill

- [x] 6.1 Author `skills/crumb-adopt-existing-project/SKILL.md`: frontmatter `name` (with `crumb-` prefix) and `description` phrased as a trigger condition ("Use when adopting Crumb into an existing web-app project…")
- [x] 6.2 Body carries the ceremony only: run `bun run extract`, apply `crumb-source/`, merge the `package.json` fragment, reconcile `tsconfig.json` with the kit's required compiler options, map existing UI into `src/app/ui/` and adjust the build to a single server-less `uiScript` entry, write `src/app/app.config.ts` + root registry, `bun install`, `bun run dev`; defer to `crumb-source/MERGE.md` and the how-to for detail
- [x] 6.3 State the divide explicitly: `extract` guarantees the safe copy; the skill operates on the developer's own repo under version control and stages changes for review
- [x] 6.4 Run `bun run install:skills` to generate the committed copies under `.claude/skills/`, `.codex/skills/`, `.github/skills/`
- [x] 6.5 Confirm `bun run install:skills --check` passes

## 7. Wiring and docs

- [x] 7.1 Add `"extract": "bun run scripts/extract.ts"` to `package.json` scripts
- [x] 7.2 Add a "Bring Crumb into an existing project" section to `README.md` next to the Quick start, naming both `bun run extract` and the `crumb-adopt-existing-project` skill
- [x] 7.3 Add a corresponding section to `docs/how-to-build-a-desktop-app-with-bun.md`
- [x] 7.4 Ensure `scripts/extract.ts` passes `bun run typecheck`

## 8. Tests

- [x] 8.1 Add `test/kit/extract.test.ts`: allowlist entries all exist in the repo
- [x] 8.2 Test staging into a temp target dir: expected files present, `src/app/` and `examples/` absent, fragments and `MERGE.md` written
- [x] 8.3 Test no-write-outside-`crumb-source/` and clone-unmodified guarantees using a temp copy of a fake target
- [x] 8.4 Test guard failures: missing `--dest`, non-directory `--dest`, `--dest` inside the clone, pre-existing non-empty `crumb-source/` without `--force`
- [x] 8.5 Test `--dry-run` writes nothing and still prints a full plan
- [x] 8.6 Extend the skills test (or add one) asserting `crumb-adopt-existing-project` is discovered and its committed copies match
- [x] 8.7 Run `bun test` and `bun run typecheck`; update OpenSpec artifacts if behavior shifted during implementation
