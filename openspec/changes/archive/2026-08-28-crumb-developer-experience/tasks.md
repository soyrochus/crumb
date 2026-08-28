## 1. Application registry

Turn one named application into a lookup, changing nothing else. The explorer stays the default until group 5, so this group is observably a no-op.

- [x] 1.1 Extend `src/kit/shared/config.ts` with an `ApplicationRegistry` shape: applications keyed by name, plus the default name. `ApplicationConfig` is unchanged
- [x] 1.2 Restructure `app.config.ts` into a registry with `file-explorer` as its single entry and default; keep its title, dimensions, CSP, and operation table exactly as they are
- [x] 1.3 Add `resolveApplication(registry, name?)` to the kit — returns the named application or the default, and throws listing available names when the name is unknown
- [x] 1.4 Update `main.ts`, `scripts/dev.ts`, `scripts/build.ts`, and `scripts/ui-artifact.ts` to resolve through the registry
- [x] 1.5 Derive each build's output filename from the selected application rather than a fixed `outputStem`
- [x] 1.6 `bun test`, `bun run typecheck`, `bun run dev`, and `bun run build --target=macos-arm64` all behave exactly as before

## 2. Move the explorer to examples/

- [x] 2.1 `git mv src/app examples/file-explorer/src` — the application's own source keeps its internal structure
- [x] 2.2 `git mv test/app examples/file-explorer/test`; fix relative import depth
- [x] 2.3 Move the explorer's registry entry into `examples/file-explorer/app.config.ts`; the root `app.config.ts` imports and registers it
- [x] 2.4 Point `verify:readonly` at `examples/file-explorer/src/**/*.ts`
- [x] 2.5 Update the explorer's boundary test glob to match
- [x] 2.6 Confirm `bun test` finds the relocated tests — 50 pass, 108 expectations, 0 fail
- [x] 2.7 Confirm `src/kit/` still has zero import edges into any application directory

## 3. Child-process runner, without watching

The riskiest step. Get a plain run working before any watcher exists, so a virtual-module resolution failure is never tangled with a watcher bug.

- [x] 3.1 Write the runner entry that registers the `app:ui` / `app:native` Bun plugin in its own process and calls `startApplication` with the resolved application
- [x] 3.2 `scripts/dev.ts` spawns the runner as a child process instead of importing the host, forwarding stdout and stderr
- [x] 3.3 Ctrl-C in the development command terminates the child and exits cleanly, leaving no orphaned process
- [x] 3.4 A host startup failure surfaces the child's error and the command exits non-zero
- [x] 3.5 `bun run dev` opens the explorer and it is fully usable: navigate, preview text, preview an image, toggle hidden files, close
- [x] 3.6 `bun run dev --example file-explorer` selects it by name; an unknown name fails immediately listing available applications and builds nothing
- [x] 3.7 `bun run build --target=macos-arm64` still produces a working executable that runs from an empty directory

## 4. Watching and development-only DevTools

- [x] 4.1 Watch the selected application's source and `src/kit/`; never watch `dist/`, `.build/`, or `node_modules/`
- [x] 4.2 On change: rebuild the UI artifact, terminate the child, restart it, and print one line naming what changed
- [x] 4.3 Debounce rapid successive changes so one save produces one restart
- [x] 4.4 A build error is reported and the watcher survives it; a corrected change rebuilds without restarting the command
- [x] 4.5 `--no-watch` runs once and establishes no watcher
- [x] 4.6 Pass a development flag from the runner to `startApplication`; the kit enables `devtools` only when it is set
- [x] 4.7 Confirm `ApplicationConfig` has no field capable of enabling DevTools, so a release cannot express the unsafe state
- [x] 4.8 Add a kit test asserting the release path yields `devtools: false` and that no configuration value overrides it
- [x] 4.9 Manually verify: edit `examples/file-explorer/src/ui/styles.css` while running and see the change without touching the terminal

## 5. The minimal application

- [x] 5.1 Write `src/app/` — one window, one declared operation with a real validator, a button that calls it, and a rendered result. No filesystem access, no styling beyond the minimum, target roughly forty lines of application code
- [x] 5.2 Give it its own window title and dimensions, and the template's default CSP
- [x] 5.3 Register it in `app.config.ts` and make it the default application
- [x] 5.4 `bun run dev` with no arguments opens the minimal application
- [x] 5.5 Confirm the minimal application is **not** scanned by `verify:readonly` — the default application a clone opens is free to write, which is the read-only separation made observable
- [x] 5.6 Add a kit test for `resolveApplication`: default when unnamed, the named application when named, a listing error when unknown
- [x] 5.7 `bun run build` with no `--example` builds the minimal application under its own output name

## 6. Continuous integration

- [x] 6.1 Add `.github/workflows/verify.yml` running `bun test`, `bun run typecheck`, and `bun run verify:readonly`, triggered by `v<major>.<minor>.<patch>` tags rather than by every push
- [x] 6.2 Build both applications on macOS arm64
- [x] 6.3 Build both applications on Linux x64, installing GTK/WebKitGTK development packages and compiling the native addon from source
- [ ] 6.4 Record the observed Linux job duration in the change notes — it is the baseline that justifies the prebuilt-addon change. **Blocked: requires a version tag to be pushed to GitHub.** The full macOS command sequence was dry-run locally and passes; the Linux leg's duration cannot be observed from here
- [ ] 6.5 Confirm a broken build fails the workflow. **Blocked: requires a version tag to be pushed to GitHub.** Now costs a throwaway tag rather than a commit to main
- [x] 6.6 Replace the README's hardcoded "36 tests passing" badge with one reflecting the actual workflow result

## 7. Documentation

- [x] 7.1 `README.md` Quick start — a clone now opens the minimal application; explain how to run and read the explorer
- [x] 7.2 Project structure — `src/app/` is the minimal starting point, `examples/file-explorer/` is the worked example
- [x] 7.3 Development commands table — add `--example <name>` and `--no-watch`
- [x] 7.4 Document that DevTools are available in development and absent from releases
- [x] 7.5 `docs/build-and-runtime.md` — application selection and the two build targets per application
- [x] 7.6 Re-check that every path the README names resolves

## 8. Acceptance

> Defect found and fixed during acceptance: `scripts/verify-performance.ts` resolved the registry *default*, which became the starter in group 5, then timed out waiting for the explorer's `#entries` pane. It now names `file-explorer` explicitly, with a comment recording why.


- [x] 8.1 `bun test` — 0 fail, no assertion lost against the 50 pass / 108 expectations baseline
- [x] 8.2 `bun run typecheck` passes
- [x] 8.3 `bun run verify:readonly` passes, scanning the explorer and not the minimal application
- [x] 8.4 `bun run verify:performance` passes with no regression beyond noise
- [x] 8.5 Both applications build on macOS arm64; **each** runs from an empty directory. Originally this only exercised the starter, which let a real regression through: the build embedded the selected application's UI while `main.ts` resolved the registry *default*, so `--example=file-explorer` produced a binary showing the explorer's page wired to the starter's operations — every call rejected as undeclared. Fixed with an `app:selection` virtual module supplying the build-time choice; guarded by `test/kit/build-time-selection.test.ts`
- [x] 8.6 A release executable has DevTools disabled
- [x] 8.7 CI green on both supported targets
- [x] 8.8 A fresh clone, `bun install`, `bun run dev` opens the minimal application, and its complete source reads in one sitting
