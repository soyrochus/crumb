## 1. Kit skeleton and wholly-template files

Move files that contain no application domain concept. Use `git mv` so rename detection keeps the diff reviewable — the claim of this change is that content is unchanged, and a reviewer must be able to see that.

- [ ] 1.1 Create `src/kit/host/`, `src/kit/ui/`, `src/kit/shared/`
- [ ] 1.2 `git mv src/host/platform.ts src/kit/host/platform.ts` — moves whole; contains no explorer concept
- [ ] 1.3 `git mv src/ui/client.ts src/kit/ui/client.ts` — moves whole; the typed `invoke` wrapper is generic over the declared operation map
- [ ] 1.4 `git mv src/ui/virtual.d.ts src/kit/ui/virtual.d.ts` — content unchanged in this step; specifiers renamed in group 4
- [ ] 1.5 Fix import paths in the moved files only; run `bun run typecheck` and expect failures confined to files not yet moved
- [ ] 1.6 `bun test` — 36 pass, 0 fail

## 2. Application skeleton and wholly-example files

- [ ] 2.1 Create `src/app/host/`, `src/app/ui/`, `src/app/shared/`
- [ ] 2.2 `git mv src/host/filesystem.ts src/app/host/filesystem.ts`
- [ ] 2.3 `git mv src/host/preview.ts src/app/host/preview.ts`
- [ ] 2.4 `git mv src/ui/app.ts src/app/ui/app.ts`
- [ ] 2.5 `git mv src/ui/state.ts src/app/ui/state.ts`
- [ ] 2.6 `git mv src/ui/index.html src/app/ui/index.html` and `git mv src/ui/styles.css src/app/ui/styles.css`
- [ ] 2.7 Update `scripts/ui-artifact.ts` to read the three UI asset paths from `src/app/ui/`
- [ ] 2.8 Fix import paths in the moved files; `bun test` — 36 pass, 0 fail

## 3. Split the three mixed files

The boundary runs through these files rather than between them. Split each in its own step with its own verification, so a failure is attributable.

- [ ] 3.1 Split `src/shared/contracts.ts`: `Result`, `DomainError`, `DomainErrorCode`, and the generic operation-map shape to `src/kit/shared/transport.ts`; `ItemDetails`, `DirectoryEntry`, `DirectoryListing`, the four `Preview` variants, `Location`, `PlatformInfo`, and the concrete operation map to `src/app/shared/contracts.ts`
- [ ] 3.2 Split `src/shared/validation.ts`: `normalizeAbsolutePath`, `expectPlainObject`, `expectNoKeys`, `ValidationError`, and `normalizeError` to `src/kit/shared/validation.ts`; delete `validateRpcInput`'s `if` chain
- [ ] 3.3 Write `src/app/shared/validators.ts` — one validator per declared operation, carrying the exact checks the `if` chain performed: no-argument operations reject any key, `getPreview` rejects any key but `path`, `listDirectory` requires a boolean `showHidden` and rejects unknown keys, and all path inputs go through `normalizeAbsolutePath`
- [ ] 3.4 `bun test test/validation.test.ts` — every existing validation assertion still passes against the new table
- [ ] 3.5 Rewrite `src/kit/host/rpc.ts`: the router takes a record of operation name → `{ validate, handle }` and resolves handlers from it. Remove `RPC_METHODS` and `isRpcMethod` — an undeclared name is one absent from the record
- [ ] 3.6 Split `src/host/main.ts`: window construction, Wayland guard, CSP application, message loop, and lifecycle to `src/kit/host/main.ts`; the four handler implementations to `src/app/host/handlers.ts`
- [ ] 3.7 Write `app.config.ts` at the repository root: application name, window title and dimensions, CSP string, build targets and output names, UI and host entry paths, and the declared operation table pairing each validator with its handler. Every value moves at its current setting — window stays 1200×760 with an 800×500 minimum, and the CSP string is copied verbatim
- [ ] 3.8 `src/kit/host/main.ts` reads `app.config.ts` for title, dimensions, CSP, and the operation table; it must contain no operation name
- [ ] 3.9 Update `scripts/verify-performance.ts` imports for the five modules it pulls across the boundary
- [ ] 3.10 `bun run typecheck` and `bun test` — 36 pass, 0 fail, 87 expectations

## 4. Virtual module rename and build scripts

- [ ] 4.1 Rename the specifiers in `src/kit/ui/virtual.d.ts`: `crumb:ui` → `app:ui`, `crumb:native` → `app:native`
- [ ] 4.2 Update `src/kit/host/main.ts` imports to the new specifiers
- [ ] 4.3 Update `scripts/dev.ts`: resolver filter, namespace, and the `"crumb:".length` slice
- [ ] 4.4 Update `scripts/build.ts`: both `onResolve` filters, the `crumb` and `crumb-native` namespaces, and the entrypoint path (now `src/kit/host/main.ts`)
- [ ] 4.5 `scripts/build.ts` and `scripts/dev.ts` take output names and entry paths from `app.config.ts` rather than their own literals — but keep the addon `require` a statically analyzable literal so Bun still embeds it
- [ ] 4.6 `bun run dev` opens the explorer and it is fully usable: navigate, preview text, preview an image, toggle hidden files, close
- [ ] 4.7 `bun run build --target=macos-arm64` succeeds; copy the executable alone to an empty directory and confirm it launches and browses there. This is the check that catches a broken native-addon embed

## 5. Tests and the read-only boundary

- [ ] 5.1 `git mv test/platform.test.ts test/kit/platform.test.ts` and `git mv test/validation.test.ts test/kit/validation.test.ts`
- [ ] 5.2 `git mv` `filesystem.test.ts`, `preview.test.ts`, and `state.test.ts` to `test/app/`
- [ ] 5.3 Split `test/read-only-boundary.test.ts`: the "exactly four RPC methods" assertion becomes `test/app/declared-operations.test.ts`, asserting the example's `app.config.ts` declares exactly its four
- [ ] 5.4 The static-scan assertion becomes `test/app/read-only-boundary.test.ts` with its glob narrowed to `src/app/**/*.ts`
- [ ] 5.5 Add `test/kit/rpc-surface.test.ts` — the router rejects an undeclared operation name with a controlled error and invokes no handler. This executes `desktop-shell` — Narrow declared RPC surface instead of leaving it to review
- [ ] 5.6 Narrow `scripts/verify-readonly.ts` from `src/{host,shared}/**/*.ts` to `src/app/**/*.ts`
- [ ] 5.7 `bun test` — 36 pass minimum, 0 fail. The count may rise by the new kit test; it must not fall, and no existing assertion may be dropped
- [ ] 5.8 `bun run verify:readonly` passes and, when pointed at `src/kit/`, finds nothing to check — the example's rule no longer reaches template source

## 6. Boundary enforcement

Converts three `template-identity` requirements from review-based to mechanical.

- [ ] 6.1 Confirm no file under `src/kit/` imports from `src/app/`: `grep -rn "app/" src/kit/` returns no import
- [ ] 6.2 Confirm no application-facing identifier is branded: `grep -rn "crumb" src/kit/ src/app/ app.config.ts` returns nothing but the application's own display name
- [ ] 6.3 Confirm `src/app/` is replaceable: temporarily move it aside, verify `bun run typecheck` fails only on missing application modules and never inside `src/kit/`, then restore it
- [ ] 6.4 Confirm `src/kit/` contains no domain vocabulary — no `directory`, `preview`, `listing`, `entry`, or `location` in a type or function name

## 7. Documentation

- [ ] 7.1 `README.md` Project structure — describe the layout that now exists: `src/kit/`, `src/app/`, `app.config.ts`, `scripts/`, `native/`, `test/`
- [ ] 7.2 Delete the "Where this is going" section; it described this change as pending
- [ ] 7.3 Update the Quick start paragraph that tells a new user what to replace — it currently names `src/ui/` and `src/host/` and should name `src/app/` and `app.config.ts`
- [ ] 7.4 Update the Architecture section so the declared-operations paragraph points at `app.config.ts`
- [ ] 7.5 `docs/build-and-runtime.md` — update any source path it names
- [ ] 7.6 Re-check every path the README names actually resolves

## 8. Acceptance

- [ ] 8.1 `bun test` — 0 fail, no assertion dropped
- [ ] 8.2 `bun run typecheck` passes
- [ ] 8.3 `bun run verify:readonly` passes
- [ ] 8.4 `bun run verify:performance` passes with no regression beyond noise against the recorded figures (UI startup 122 ms, 5,000 rows 5 ms, ordinary listing 18.1 ms, retained RSS 0.1 MiB)
- [ ] 8.5 One target executable built and exercised from an empty directory
- [ ] 8.6 `git diff --stat` reviewed: renames detected as renames, and every file with genuine content edits is one of the four the design names — `main.ts`, `contracts.ts`, `validation.ts`, `rpc.ts` — plus `app.config.ts`, the scripts, and the split tests
