## 1. Kit skeleton and wholly-template files

Move files that contain no application domain concept. Use `git mv` so rename detection keeps the diff reviewable — the claim of this change is that content is unchanged, and a reviewer must be able to see that.

- [x] 1.1 Create `src/kit/host/`, `src/kit/ui/`, `src/kit/shared/`
- [x] 1.2 `git mv src/host/platform.ts src/kit/host/platform.ts` — moves whole; contains no explorer concept
- [x] 1.3 **Corrected during implementation.** `src/ui/client.ts` is *not* wholly kit: its `rpc` facade names all four explorer operations and its `assertListing` / `assertPreview` guards are explorer-shaped. Split instead — generic transport to `src/kit/ui/bridge.ts`, the facade and guards to `src/app/ui/client.ts`
- [x] 1.4 `git mv src/ui/virtual.d.ts src/kit/ui/virtual.d.ts` — content unchanged in this step; specifiers renamed in group 4
- [x] 1.5 Fix import paths in the moved files only; run `bun run typecheck` and expect failures confined to files not yet moved
- [x] 1.6 `bun test` — 36 pass, 0 fail

## 2. Application skeleton and wholly-example files

- [x] 2.1 Create `src/app/host/`, `src/app/ui/`, `src/app/shared/`
- [x] 2.2 `git mv src/host/filesystem.ts src/app/host/filesystem.ts`
- [x] 2.3 `git mv src/host/preview.ts src/app/host/preview.ts`
- [x] 2.4 `git mv src/ui/app.ts src/app/ui/app.ts`
- [x] 2.5 `git mv src/ui/state.ts src/app/ui/state.ts`
- [x] 2.6 `git mv src/ui/index.html src/app/ui/index.html` and `git mv src/ui/styles.css src/app/ui/styles.css`
- [x] 2.7 Update `scripts/ui-artifact.ts` to read the three UI asset paths from `src/app/ui/`
- [x] 2.8 Fix import paths in the moved files; `bun test` — 36 pass, 0 fail

## 3. Split the three mixed files

The boundary runs through these files rather than between them. Split each in its own step with its own verification, so a failure is attributable.

- [x] 3.1 Split `src/shared/contracts.ts`: `Result`, `DomainError`, `DomainErrorCode`, and the generic operation-map shape to `src/kit/shared/transport.ts`; `ItemDetails`, `DirectoryEntry`, `DirectoryListing`, the four `Preview` variants, `Location`, `PlatformInfo`, and the concrete operation map to `src/app/shared/contracts.ts`
- [x] 3.2 Split `src/shared/validation.ts`: `normalizeAbsolutePath`, `expectPlainObject`, `expectNoKeys`, `ValidationError`, and `normalizeError` to `src/kit/shared/validation.ts`; delete `validateRpcInput`'s `if` chain
- [x] 3.3 Write `src/app/shared/validators.ts` — one validator per declared operation, carrying the exact checks the `if` chain performed: no-argument operations reject any key, `getPreview` rejects any key but `path`, `listDirectory` requires a boolean `showHidden` and rejects unknown keys, and all path inputs go through `normalizeAbsolutePath`
- [x] 3.4 `bun test test/validation.test.ts` — every existing validation assertion still passes against the new table
- [x] 3.5 Rewrite `src/kit/host/rpc.ts`: the router takes a record of operation name → `{ validate, handle }` and resolves handlers from it. Remove `RPC_METHODS` and `isRpcMethod` — an undeclared name is one absent from the record
- [x] 3.6 Split `src/host/main.ts`: window construction, Wayland guard, CSP application, message loop, and lifecycle to `src/kit/host/main.ts`; the four handler implementations to `src/app/host/handlers.ts`
- [x] 3.7 Write `app.config.ts` at the repository root: application name, window title and dimensions, CSP string, build targets and output names, UI and host entry paths, and the declared operation table pairing each validator with its handler. Every value moves at its current setting — window stays 1200×760 with an 800×500 minimum, and the CSP string is copied verbatim
- [x] 3.8 **Inverted during implementation.** Having the kit read `app.config.ts` created a kit→app import edge that broke task 6.3. Instead `src/kit/host/main.ts` exports `startApplication(config)`, the kit defines the config *shape* in `src/kit/shared/config.ts`, and a root `main.ts` hands the application's config to the kit. `src/kit/` now has zero import edges into `src/app/`
- [x] 3.9 Update `scripts/verify-performance.ts` imports for the five modules it pulls across the boundary
- [x] 3.10 `bun run typecheck` and `bun test` — 36 pass, 0 fail, 87 expectations

## 4. Virtual module rename and build scripts

- [x] 4.1 Rename the specifiers in `src/kit/ui/virtual.d.ts`: `crumb:ui` → `app:ui`, `crumb:native` → `app:native`
- [x] 4.2 Update `src/kit/host/main.ts` imports to the new specifiers
- [x] 4.3 Update `scripts/dev.ts`: resolver filter, namespace, and the `"crumb:".length` slice
- [x] 4.4 Update `scripts/build.ts`: both `onResolve` filters, the `crumb` and `crumb-native` namespaces, and the entrypoint path (now `src/kit/host/main.ts`)
- [x] 4.5 `scripts/build.ts` and `scripts/dev.ts` take output names and entry paths from `app.config.ts` rather than their own literals — but keep the addon `require` a statically analyzable literal so Bun still embeds it
- [x] 4.6 `bun run dev` opens the explorer and it is fully usable: navigate, preview text, preview an image, toggle hidden files, close
- [x] 4.7 `bun run build --target=macos-arm64` succeeds; copy the executable alone to an empty directory and confirm it launches and browses there. This is the check that catches a broken native-addon embed

## 5. Tests and the read-only boundary

- [x] 5.1 `git mv test/platform.test.ts test/kit/platform.test.ts` and `git mv test/validation.test.ts test/kit/validation.test.ts`
- [x] 5.2 `git mv` `filesystem.test.ts`, `preview.test.ts`, and `state.test.ts` to `test/app/`
- [x] 5.3 Split `test/read-only-boundary.test.ts`: the "exactly four RPC methods" assertion now reads the example's `app.config.ts` and asserts it declares exactly its four. Kept in `test/app/read-only-boundary.test.ts` beside the static scan rather than in a separate `declared-operations.test.ts` — both assertions are about the same example-owned boundary
- [x] 5.4 The static-scan assertion becomes `test/app/read-only-boundary.test.ts` with its glob narrowed to `src/app/**/*.ts`
- [x] 5.5 Add `test/kit/rpc-surface.test.ts` — the router rejects an undeclared operation name with a controlled error and invokes no handler. This executes `desktop-shell` — Narrow declared RPC surface instead of leaving it to review
- [x] 5.6 Narrow `scripts/verify-readonly.ts` from `src/{host,shared}/**/*.ts` to `src/app/**/*.ts`
- [x] 5.7 `bun test` — 36 pass minimum, 0 fail. The count may rise by the new kit test; it must not fall, and no existing assertion may be dropped
- [x] 5.8 `bun run verify:readonly` passes and, when pointed at `src/kit/`, finds nothing to check — the example's rule no longer reaches template source

## 6. Boundary enforcement

Converts three `template-identity` requirements from review-based to mechanical.

- [x] 6.1 Confirm no file under `src/kit/` imports from `src/app/`: `grep -rn "app/" src/kit/` returns no import
- [x] 6.2 Confirm no application-facing identifier is branded: `grep -rn "crumb" src/kit/ src/app/ app.config.ts` returns nothing but the application's own display name
- [x] 6.3 Confirm `src/app/` is replaceable: temporarily move it aside, verify `bun run typecheck` fails only on missing application modules and never inside `src/kit/`, then restore it
- [x] 6.4 Confirm `src/kit/` contains no domain vocabulary — no `directory`, `preview`, `listing`, `entry`, or `location` in a type or function name

## 7. Documentation

- [x] 7.1 `README.md` Project structure — describe the layout that now exists: `src/kit/`, `src/app/`, `app.config.ts`, `scripts/`, `native/`, `test/`
- [x] 7.2 Delete the "Where this is going" section; it described this change as pending
- [x] 7.3 Update the Quick start paragraph that tells a new user what to replace — it currently names `src/ui/` and `src/host/` and should name `src/app/` and `app.config.ts`
- [x] 7.4 Update the Architecture section so the declared-operations paragraph points at `app.config.ts`
- [x] 7.5 `docs/build-and-runtime.md` — update any source path it names
- [x] 7.6 Re-check every path the README names actually resolves

## 8. Acceptance

> Deviations from plan, both discovered by the tasks doing their job: 1.3 (client.ts is mixed, not kit) and 3.8 (kit must receive config, not import it). Recorded in place above.


- [x] 8.1 `bun test` — 0 fail, no assertion dropped
- [x] 8.2 `bun run typecheck` passes
- [x] 8.3 `bun run verify:readonly` passes
- [x] 8.4 `bun run verify:performance` passes with no regression beyond noise against the recorded figures (UI startup 122 ms, 5,000 rows 5 ms, ordinary listing 18.1 ms, retained RSS 0.1 MiB)
- [x] 8.5 One target executable built and exercised from an empty directory
- [x] 8.6 `git diff --stat` reviewed: renames detected as renames, and every file with genuine content edits is one of the four the design names — `main.ts`, `contracts.ts`, `validation.ts`, `rpc.ts` — plus `app.config.ts`, the scripts, and the split tests
