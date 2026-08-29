---
name: crumb-adopt-existing-project
description: Use when adopting Crumb into an existing web-app project — running it as a desktop app without moving the project into a Crumb clone. Applies the `bun run extract` staging output into the project.
---

# Adopt Crumb into an existing project

Crumb is a template you normally clone. This skill is the other direction:
bringing Crumb's machinery into a repository that already holds a web
application, so it can ship as a desktop app without relocating.

The work is split in two. `bun run extract`, run from a Crumb clone, does the
mechanical half — it copies the template-owned machinery into
`<project>/crumb-source/` and never touches the clone or any file the project
already has. This skill does the judgement half: applying that staging directory
into the project. Do this work on the developer's own repository, under their
version control, and leave the changes staged for their review — never assume a
clean apply.

## Step 1 — produce the staging directory

From a Crumb clone (not the target project):

```sh
bun run extract -- --dest /path/to/existing-project
```

That writes `existing-project/crumb-source/` containing the kit, the build and
dev pipeline, the native binding patch, `main.ts`, `tsconfig.json`, the template
tests, a `fragments/` directory, and `MERGE.md`. `--dry-run` previews it;
`--force` re-stages over an existing `crumb-source/`.

`MERGE.md` is the authoritative apply checklist and records which Crumb version
was extracted. Read it first.

## Step 2 — apply it into the project

Work through `crumb-source/MERGE.md` in order. In outline:

1. **Move the machinery into place.** Everything in `crumb-source/` except
   `fragments/` and `MERGE.md` goes to the project root at the same relative
   path (`src/kit/`, `scripts/`, `native/`, `test/kit/`, `main.ts`,
   `tsconfig.json`). If the project already has a file at one of these paths,
   that collision is a decision for the developer — surface it, do not silently
   overwrite or skip.
2. **Merge `fragments/package.json`** into the project's `package.json`: the
   `type`, `scripts`, `dependencies`, and `devDependencies` keys. Keep the
   project's own scripts; add Crumb's beside them.
3. **Reconcile `tsconfig.json`.** The kit needs the compiler options the
   extracted `tsconfig.json` sets (`strict`, `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`,
   `allowImportingTsExtensions`, `types: ["bun"]`, and the `src`/`scripts`/`test`
   includes). If the project has its own, merge these in rather than replacing
   it.
4. **Append `fragments/gitignore`** lines (`node_modules/`, `dist/`, `.build/`)
   to the project's `.gitignore`.
5. **Shape the interface into `src/app/`.** See below.
6. **Place `fragments/app.config.ts`** at the project root once
   `src/app/app.config.ts` exists.
7. **`bun install`, then `bun run dev`.**

## Shaping the existing interface into `src/app/`

Crumb builds the UI from a single `uiScript` entry with `Bun.build()` and **no
dev server**. This is the part that varies most per project.

- **Plain HTML/CSS/TS** maps almost directly. Put the document at
  `src/app/ui/index.html` with `<link rel="stylesheet" href="./styles.css">` and
  `<script type="module" src="./app.ts">`, the styles at `src/app/ui/styles.css`,
  and a single entry module at `src/app/ui/app.ts`.
- **A framework build (Vite, webpack, Next, SSR)** must be reduced to browser
  code Bun can bundle from that one entry, with nothing fetched at runtime.
  Anything that currently needs `localhost` or a server has to move behind a
  declared host operation instead.
- Privileged work (filesystem, OS, native) goes in `src/app/host/handlers.ts`
  behind a declared, validated operation — never a generic bridge.

Write `src/app/app.config.ts` exporting one `ApplicationConfig` whose `entries`
point at the three UI files (paths relative to the project root), then let the
root `app.config.ts` from the fragment register it as `starter`.

## The dual-CSP invariant

The Content Security Policy is declared twice and both must agree:
`src/app/ui/index.html` uses `script-src 'self'; style-src 'self'`;
`src/app/app.config.ts` uses `'unsafe-inline'` for both, because the release
build inlines them. Change one without the other and the app works under
`bun run dev` but breaks on release, or loses a restriction silently.

## Ownership

`src/app/` and the developer's own code are theirs. `src/kit/` is the
template's and a normal application never modifies it. If adopting the project
seems to require editing the kit, that is a design signal, not a step.

## Beyond the ceremony

`crumb-source/MERGE.md` is the apply checklist for a specific extract.
[`docs/how-to-build-a-desktop-app-with-bun.md`](../../docs/how-to-build-a-desktop-app-with-bun.md)
is the full walkthrough of the application structure, the bridge, and the build,
and the requirements under [`openspec/specs/`](../../openspec/specs/) are
normative. Where this skill disagrees with either, they govern and this skill is
what gets corrected.
