## Why

`retarget-crumb-as-template` established that Crumb is the template and `file-explorer` is the example, and wrote the boundary into the specs. The code does not yet honour it. Template and example are still interleaved inside single files: `src/host/main.ts` holds the window bootstrap next to four explorer handlers, `src/shared/contracts.ts` holds `Result` and `RpcMethods` next to `DirectoryListing`, and `src/shared/validation.ts` hardcodes an `if` chain over the explorer's method names. Nothing in the repository can be pointed at and called "Crumb" as distinct from "the file browser".

Until the split exists on disk, the boundary is a claim rather than a fact: a reader cannot tell which code they would keep, `bun run verify:readonly` still checks template source it has no business checking, and the virtual module specifiers `crumb:ui` and `crumb:native` would put the project's name inside every downstream application's build plumbing.

## What Changes

- Create `src/kit/` — the template proper, free of any application domain concept: native window bootstrap and lifecycle, the RPC router and its browser-side client, generic input-validation helpers, platform detection, and the `Result` / `DomainError` transport types.
- Create `src/app/` — the `file-explorer` example, moved wholesale: its four handlers, filesystem inspection, preview generation, domain contracts, browser UI, and transient state. **This is the directory a new project replaces.**
- Introduce `app.config.ts` — the one file a new application edits first: name, window title and dimensions, Content Security Policy, build targets, entry paths, and the declared RPC operations with their input validators.
- Replace the hardcoded method dispatch. `validateRpcInput`'s `if` chain over `getPlatformInfo` / `getLocations` / `listDirectory` / `getPreview` becomes a per-operation validator table the application supplies; the kit routes whatever is declared and knows none of the names.
- Rename the build-time virtual modules `crumb:ui` → `app:ui` and `crumb:native` → `app:native` in `scripts/dev.ts`, `scripts/build.ts`, and the ambient declarations. The project keeps the name Crumb; an application built on it carries no Crumb branding in its own source.
- Narrow `scripts/verify-readonly.ts` from `src/{host,shared}/**` to the example's source only, and split `test/read-only-boundary.test.ts`: the "exactly four methods" assertion belongs to the example, the "no undeclared capability is reachable" assertion belongs to the kit.
- Move the six test files to match, keeping every assertion. `platform` and `validation` become kit tests; `filesystem`, `preview`, and `state` become example tests.
- Update `README.md` Project structure to describe the layout that now exists, and delete the forward-looking section that described it as pending.

**Not in scope:** the minimal example, watch mode, dev DevTools, CI, and a prebuilt Linux addon are `crumb-developer-experience` (change 3). `examples/` is not created here — `src/app/` holds the explorer and remains the application the repository builds.

## Capabilities

### New Capabilities

None. This change implements behavior that `retarget-crumb-as-template` already specified; it introduces no new promise.

### Modified Capabilities

None. Every observable behavior is already required by an existing capability, and each is a checkable acceptance criterion for this change rather than a new one:

| What this change does | Already required by |
| --- | --- |
| `src/kit/` free of application domain types; `src/app/` replaceable alone | `template-identity` — Template and application ownership boundary |
| `app.config.ts` supplies window title and dimensions | `desktop-shell` — Supported native desktop shell |
| Kit routes only application-declared operations, validating each | `desktop-shell` — Narrow declared RPC surface |
| Kit supplies the default CSP; the application may widen it | `desktop-shell` — Restrictive document policy |
| `crumb:ui` / `crumb:native` → `app:ui` / `app:native` | `template-identity` — Project and example naming |
| Read-only check scoped to the example's source | `filesystem-browsing` — Read-only filesystem implementation |

`skip_specs: true` is set in `.openspec.yaml`. This is a pure refactor: no requirement is added, changed, or removed, and inventing one to satisfy validation would misrepresent the change.

## Impact

- **Code**: every file under `src/` moves or is split; `scripts/dev.ts`, `scripts/build.ts`, and `scripts/verify-readonly.ts` are edited; `tsconfig.json` include paths are checked. `package.json` scripts keep their current names.
- **Tests**: all six files relocate under kit/example directories. The suite must still report **36 pass, 0 fail** — an assertion count that changes signals a behavior change this refactor must not make.
- **Docs**: `README.md` Project structure and the "Where this is going" section; `docs/build-and-runtime.md` where it names source paths.
- **Risk concentration**: `Bun.build` embeds the native addon through a statically analyzable literal path (`standalone-distribution` — Single application-owned runtime file). Moving build code risks breaking that silently, so a relocated-executable check on at least one target is part of acceptance, not an afterthought.
- **Downstream**: `crumb-developer-experience` (change 3) adds `examples/minimal/` beside `src/app/` and makes it the default `bun run dev` target, which is only tractable once `app.config.ts` exists to point at an entry.
