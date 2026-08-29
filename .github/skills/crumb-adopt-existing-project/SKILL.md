---
name: crumb-adopt-existing-project
description: Use when adopting Crumb into an existing web-app project — running it as a desktop app without moving the project into a Crumb clone. Assess feasibility, then apply the `bun run extract` staging output or propose a migration.
---

# Adopt Crumb into an existing project

Crumb is a template you normally clone. This skill is the other direction:
bringing Crumb's machinery into a repository that already holds a web
application, so it can ship as a desktop app without relocating.

The work is split in two. `bun run extract`, run from a Crumb clone, does the
mechanical half — it copies the template-owned machinery into
`<project>/crumb-source/` and never touches the clone or any file the project
already has. This skill does the judgement half.

**Do not blindly run the checklist.** Most targets are existing Node apps that
will not drop into Crumb unchanged. First assess whether adoption is possible,
then take one of three routes: apply it, propose a staged migration for the
developer to approve, or say it is not feasible. Never leave a half-merged
`package.json` or a project that builds the wrong thing. Work on a branch, under
the developer's version control, and leave changes staged for review.

## Step 1 — assess before touching anything

Read the project. Answer these:

1. **Is the interface a client-side web app?** Crumb loads one embedded HTML
   document into a native WebView with **no server at runtime** and a
   restrictive CSP (no remote `connect-src`, no remote scripts). Server-rendered
   templates, SSR frameworks, same-origin API calls, and websockets to the
   project's own backend all have to change.
2. **Can the UI build to a single browser bundle?** Crumb bundles the interface
   with `Bun.build()` from one `uiScript` entry. A Vite/webpack/Next build must
   be reducible to browser code with nothing fetched at runtime.
3. **What does the backend do, and can it move into the host?** Bun host
   handlers behind declared, validated operations replace a local backend for
   filesystem, OS, and machine-local work. A backend that exists to serve
   multiple users or external clients, hold server-only secrets, or run as a
   shared service cannot become in-process host code.
4. **Platform fit.** Crumb targets macOS arm64 and Linux (Wayland) only — no
   Windows, no X11, one window per app, unsigned executables.

## Step 2 — choose a route and tell the developer

- **Adopt now** — the interface is client-side (or trivially made so), it
  bundles from one entry, and any backend work is thin and machine-local. Do
  Step 3.
- **Propose a migration** — the UI is salvageable but the build or backend needs
  real work. Write the plan: which endpoints become host operations, what the
  build change is, what gets dropped, what the staged order is. Get the
  developer's sign-off, then do Step 3 in stages.
- **Decline** — the app fundamentally needs a server it cannot shed (multi-user,
  external clients, server-held secrets), depends on Windows, or is not a web UI.
  Say so plainly, name the blocker, and stop. Do not partially apply.

## Step 3 — apply

If `crumb-source/` is not present, run `bun run extract -- --dest <project>` from
a Crumb clone first. `crumb-source/MERGE.md` is the authoritative checklist for
that extract and names the Crumb version; read it. In outline:

1. **Move the staged tree into place.** Everything in `crumb-source/` except
   `fragments/` and `MERGE.md` goes to the project root at the same relative
   path: `src/kit/`, `scripts/`, `native/`, `test/kit/`, `skills/`, `docs/`,
   `.claude/skills/`, `.codex/skills/`, `.github/skills/`, `main.ts`,
   `tsconfig.json`. Surface every collision with an existing file as a decision;
   never silently overwrite or skip. The staged `.{claude,codex,github}/skills/`
   hold only Crumb's own `crumb-*` skills — merge them beside anything already
   there.
2. **Merge `fragments/package.json`.** Add `type`, `dependencies`, and
   `devDependencies`. For `scripts`, Crumb's `dev`, `build`, `test`, and
   `start` will usually collide with the project's. Give the standard names to
   Crumb and rename the incumbents (`dev:legacy`, `test:e2e`, `start:server`, or
   whatever fits) — do not drop a script without saying so, and do not leave
   both definitions.
3. **Reconcile `tsconfig.json`.** The kit needs `strict`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `types: ["bun"]`,
   and the `src`/`scripts`/`test` includes. Merge these into the project's
   config rather than replacing it; a stricter setting that breaks the
   project's own code is a finding to report, not something to silently relax.
4. **Append `fragments/gitignore`** (`node_modules/`, `dist/`, `.build/`).
5. **Shape the interface into `src/app/`** — see below.
6. **Place `fragments/app.config.ts`** at the project root once
   `src/app/app.config.ts` exists.
7. **Verify:** `bun install`, then `bun run typecheck`, `bun test`,
   `bun run install:skills --check`, and `bun run dev`. A failure here means the
   apply is not done — fix it or report it, do not hand back a broken tree.

## Shaping the existing interface into `src/app/`

Crumb builds the UI from a single `uiScript` entry with `Bun.build()` and **no
dev server**.

- **Plain HTML/CSS/TS** maps almost directly: document at
  `src/app/ui/index.html` with `<link rel="stylesheet" href="./styles.css">` and
  `<script type="module" src="./app.ts">`, styles at `src/app/ui/styles.css`,
  one entry module at `src/app/ui/app.ts`.
- **A framework build** must be reduced to browser code Bun can bundle from that
  one entry, with nothing fetched at runtime. Every call the UI makes to its old
  backend becomes a declared, validated host operation in
  `src/app/host/handlers.ts` — never a generic bridge.

Write `src/app/app.config.ts` exporting one `ApplicationConfig` whose `entries`
point at the three UI files (paths relative to the project root); the root
`app.config.ts` from the fragment registers it as `starter`.

## The dual-CSP invariant

The Content Security Policy is declared twice and both must agree:
`src/app/ui/index.html` uses `script-src 'self'; style-src 'self'`;
`src/app/app.config.ts` uses `'unsafe-inline'` for both, because the release
build inlines them. Change one without the other and the app works under
`bun run dev` but breaks on release, or loses a restriction silently.

## Ownership

`src/app/` and the developer's own code are theirs. `src/kit/` is the
template's and a normal application never modifies it. If adoption seems to
require editing the kit, that is a design signal, not a step.

## Beyond the ceremony

`crumb-source/MERGE.md` is the apply checklist for a specific extract.
[`docs/how-to-build-a-desktop-app-with-bun.md`](../../docs/how-to-build-a-desktop-app-with-bun.md)
is the full walkthrough of the application structure, the bridge, and the build,
and the requirements under [`openspec/specs/`](https://github.com/soyrochus/crumb/tree/main/openspec/specs/) are
normative. Where this skill disagrees with either, they govern and this skill is
what gets corrected.
