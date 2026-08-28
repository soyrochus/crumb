## 1. Spec purposes

Replace the five `TBD - created by archiving change build-crumb-file-explorer` placeholders. Edit `openspec/specs/<capability>/spec.md` Purpose sections directly — delta Purpose text is ignored for existing capabilities. Each purpose must state whether the capability is a template promise or a `file-explorer` requirement.

- [x] 1.1 `desktop-shell` — template promise: the native window, embedded offline document, validated request channel, document policy, and lifecycle that every Crumb application gets
- [x] 1.2 `standalone-distribution` — template promise: the two-stage build and the single self-contained executable per target
- [x] 1.3 `filesystem-browsing` — `file-explorer` requirement: view-only directory navigation and listing
- [x] 1.4 `file-preview` — `file-explorer` requirement: bounded, inert previews of directories, text, and images
- [x] 1.5 `three-pane-interface` — `file-explorer` requirement: the example's three-pane UI, keyboard model, and appearance
- [x] 1.6 Re-read all five purposes together and confirm the template/example split reads consistently across them

## 2. README retarget

- [x] 2.1 Replace the tagline under the logo: Crumb is the template, toolchain, and documentation for shipping server-less web apps as desktop apps
- [x] 2.2 Rewrite the opening description — lead with the template purpose; introduce the three-pane browser as `file-explorer`, the example that proves it works
- [x] 2.3 Split the current Features list into "What Crumb gives you" (native window, embedded UI, declared RPC surface, restrictive CSP, single-executable build, no server/network/telemetry) and "The file-explorer example" (three panes, navigation, previews, view-only), and caption both screenshots as the example
- [x] 2.4 Reframe the "Bun in this project" section as what the toolchain does, keeping the feature table and the Wayland-patch walkthrough intact
- [x] 2.5 Fix the core-constraints line in Principles of Participation — remove "view-only filesystem access" from Crumb's constraints and state it as the example's; keep bounded reads, native WebViews, no local server, no runtime network dependency, and no X11/XWayland fallback as Crumb's
- [x] 2.6 Update Current limitations to separate template limits (no Windows, Linux Wayland only, macOS arm64 only, unsigned binaries) from example limits (no search, no editing, metadata-only formats)
- [x] 2.7 Keep Project structure describing `src/host/`, `src/ui/`, `src/shared/` exactly as they exist today
- [x] 2.8 Add a short forward-looking section naming the target layout (`src/kit/`, `src/app/`, `app.config.ts`, `examples/minimal/`, `examples/file-explorer/`) and the `crumb:ui` / `crumb:native` → `app:ui` / `app:native` rename, explicitly attributed to the next change
- [x] 2.9 Grep the finished README for every path, command, and filename it names and confirm each one resolves in the repository today

## 3. Historical specification

`specs/crumb-spec.md` was renamed to `specs/crumb-original-now-obsolete-spec.md` and declared obsolete during this change. It is retained for history rather than retargeted — `openspec/specs/` is the living specification. Tasks 3.2-3.5 of the original plan (retitle, header block, section 1, sections 4.1/97, closing summary) are dropped as work on a document no longer claimed to be current.

- [x] 3.1 Add a superseded notice at the top of `specs/crumb-original-now-obsolete-spec.md`: what superseded it, that it describes the `file-explorer` example rather than the template, that its read-only invariant (sections 4.1 and 97) belongs to the example, and where the living specification is
- [x] 3.2 Repoint the `template-identity` "Read the project entry points" scenario away from the removed `specs/crumb-spec.md` path, and add a scenario covering retained superseded documents
- [x] 3.3 Update `proposal.md` and `design.md` to describe the superseded notice rather than a retarget of that file
- [x] 3.4 Confirm no file in the repository still references the path `specs/crumb-spec.md`

## 4. Supporting docs

- [x] 4.1 `docs/build-and-runtime.md` — describe the build pipeline as the template's, with `file-explorer` as the application it currently builds
- [x] 4.2 `docs/feasibility.md` — reword the automated-suite row so the read-only boundary check is named as the example's check
- [x] 4.3 `docs/verification.md` — leave the recorded results unchanged; adjust only wording that calls Crumb a file explorer

## 5. Verification

- [x] 5.1 `openspec validate retarget-crumb-as-template` passes
- [x] 5.2 `git diff --stat` shows changes only under `README.md`, `specs/`, `docs/`, and `openspec/` — no file under `src/`, `scripts/`, `test/`, or `package.json`
- [x] 5.3 `bun test` passes with 36 tests, unchanged
- [x] 5.4 `bun run typecheck` passes
- [x] 5.5 `bun run verify:readonly` passes — the example is still view-only and its check is untouched
- [x] 5.6 `bun run verify:performance` passes
- [x] 5.7 Read `README.md` end to end as someone who has never seen the project and confirm it answers "what do I get and what do I delete?" before it answers "how does the file explorer work?"
