## Why

Crumb is documented as "a small, view-only desktop file explorer" that incidentally demonstrates Bun, but the durable value in this repository is the template, toolchain, and documentation for shipping a server-less web app as a desktop application — one native window, one self-contained executable, no Chromium, no localhost, no runtime install. The file explorer is the example that proves it works.

Because the stated purpose never said so, the spec set records example-app decisions as Crumb-level promises: `desktop-shell` guarantees a *read-only* RPC surface listing the explorer's four methods, `standalone-distribution` names Crumb and an explorer-shaped acceptance journey, and `three-pane-interface` — otherwise entirely example UI — owns the Content Security Policy that every app built on Crumb needs. Until purpose and specs are corrected, no code can be split along a boundary the specs do not describe.

## What Changes

- Restate Crumb's purpose in `README.md`: Crumb is the template, toolchain, and documentation for server-less web apps as desktop apps. The project keeps the name **Crumb**. The three-pane browser is renamed **file-explorer**, the example application.
- Mark the retained historical specification (`specs/crumb-original-now-obsolete-spec.md`) as superseded with a notice pointing to `openspec/specs/`, rather than retargeting it. It is kept for history, not maintained.
- Introduce a `template-identity` capability that states what Crumb promises, what belongs to an example application, and the rule that a Crumb-level requirement may not encode example-specific behavior.
- Re-file requirements that sit in the wrong capability:
  - `desktop-shell` — "Narrow read-only RPC surface" becomes a *declared and enumerated* RPC surface; the method list and its read-only character move to the example. Window title and dimensions become application-declared rather than literal `"Crumb"` at 1200×760.
  - `three-pane-interface` — "Restrictive document policy" (the CSP) is removed here and added to `desktop-shell`, where it is a template guarantee rather than an example-UI detail.
  - `filesystem-browsing` — "Read-only filesystem implementation" is restated as the example application's constraint and scopes the static boundary check to example source. **The explorer stays view-only; only the ownership of that rule changes.**
  - `standalone-distribution` — "Permitted operating-system dependencies" and "Clean-machine acceptance" stop naming Crumb and the explorer's journey, and describe the built application instead.
- Replace the five `TBD - created by archiving change build-crumb-file-explorer` Purpose sections with real purposes that state whether each capability is a template promise or an example-app requirement.
- Document the `crumb:ui` / `crumb:native` → `app:ui` / `app:native` rename and the `src/kit/` ÷ `examples/` layout as the target the next change implements.
- **No source code, build script, or test changes.** `verify-readonly.ts` keeps its current repo-wide glob until the extraction change moves it; this change only records that its scope is the example.

## Capabilities

### New Capabilities
- `template-identity`: What Crumb is and what it guarantees — the template/toolchain/docs purpose, the boundary between template-owned and application-owned code, the naming rules (project stays `crumb`; the example is `file-explorer`; app-facing plumbing is not branded `crumb`), and the constraint that template requirements may not encode example-app behavior.

### Modified Capabilities
- `desktop-shell`: "Narrow read-only RPC surface" is replaced by a declared-and-enumerated RPC surface requirement that does not name the explorer's methods or assert read-only-ness; the supported-platform scenario takes window title and size from application declaration; the restrictive document policy requirement is added here.
- `three-pane-interface`: "Restrictive document policy" is removed (it moves to `desktop-shell`).
- `filesystem-browsing`: "Read-only filesystem implementation" is restated as an example-application constraint whose static check is scoped to example source.
- `standalone-distribution`: "Permitted operating-system dependencies" and "Clean-machine acceptance" are generalized from Crumb-the-explorer to the built application.

## Impact

- **Documentation**: `README.md` (headline, description, features split, architecture, core-constraints line, project structure, limitations), a superseded notice on `specs/crumb-original-now-obsolete-spec.md`, and `docs/build-and-runtime.md` and `docs/feasibility.md` where they describe Crumb as an explorer.
- **Specs**: one new capability directory plus four delta specs under `openspec/specs/`; five Purpose sections rewritten.
- **Code**: none. `src/`, `scripts/`, `test/`, and `package.json` are untouched; `bun test`, `bun run typecheck`, `bun run verify:performance`, and `bun run verify:readonly` must pass unchanged after this change.
- **Downstream**: this change defines the boundary that `extract-crumb-kit` (change 2) implements and `crumb-developer-experience` (change 3) builds on. Sequencing it first keeps that work from re-litigating what Crumb promises.
