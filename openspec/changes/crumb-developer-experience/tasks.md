## 1. Application registry

Turn one named application into a lookup, changing nothing else. The explorer stays the default until group 5, so this group is observably a no-op.

- [ ] 1.1 Extend `src/kit/shared/config.ts` with an `ApplicationRegistry` shape: applications keyed by name, plus the default name. `ApplicationConfig` is unchanged
- [ ] 1.2 Restructure `app.config.ts` into a registry with `file-explorer` as its single entry and default; keep its title, dimensions, CSP, and operation table exactly as they are
- [ ] 1.3 Add `resolveApplication(registry, name?)` to the kit — returns the named application or the default, and throws listing available names when the name is unknown
- [ ] 1.4 Update `main.ts`, `scripts/dev.ts`, `scripts/build.ts`, and `scripts/ui-artifact.ts` to resolve through the registry
- [ ] 1.5 Derive each build's output filename from the selected application rather than a fixed `outputStem`
- [ ] 1.6 `bun test`, `bun run typecheck`, `bun run dev`, and `bun run build --target=macos-arm64` all behave exactly as before

## 2. Move the explorer to examples/

- [ ] 2.1 `git mv src/app examples/file-explorer/src` — the application's own source keeps its internal structure
- [ ] 2.2 `git mv test/app examples/file-explorer/test`; fix relative import depth
- [ ] 2.3 Move the explorer's registry entry into `examples/file-explorer/app.config.ts`; the root `app.config.ts` imports and registers it
- [ ] 2.4 Point `verify:readonly` at `examples/file-explorer/src/**/*.ts`
- [ ] 2.5 Update the explorer's boundary test glob to match
- [ ] 2.6 Confirm `bun test` finds the relocated tests — 50 pass, 108 expectations, 0 fail
- [ ] 2.7 Confirm `src/kit/` still has zero import edges into any application directory

## 3. Child-process runner, without watching

The riskiest step. Get a plain run working before any watcher exists, so a virtual-module resolution failure is never tangled with a watcher bug.

- [ ] 3.1 Write the runner entry that registers the `app:ui` / `app:native` Bun plugin in its own process and calls `startApplication` with the resolved application
- [ ] 3.2 `scripts/dev.ts` spawns the runner as a child process instead of importing the host, forwarding stdout and stderr
- [ ] 3.3 Ctrl-C in the development command terminates the child and exits cleanly, leaving no orphaned process
- [ ] 3.4 A host startup failure surfaces the child's error and the command exits non-zero
- [ ] 3.5 `bun run dev` opens the explorer and it is fully usable: navigate, preview text, preview an image, toggle hidden files, close
- [ ] 3.6 `bun run dev --example file-explorer` selects it by name; an unknown name fails immediately listing available applications and builds nothing
- [ ] 3.7 `bun run build --target=macos-arm64` still produces a working executable that runs from an empty directory

## 4. Watching and development-only DevTools

- [ ] 4.1 Watch the selected application's source and `src/kit/`; never watch `dist/`, `.build/`, or `node_modules/`
- [ ] 4.2 On change: rebuild the UI artifact, terminate the child, restart it, and print one line naming what changed
- [ ] 4.3 Debounce rapid successive changes so one save produces one restart
- [ ] 4.4 A build error is reported and the watcher survives it; a corrected change rebuilds without restarting the command
- [ ] 4.5 `--no-watch` runs once and establishes no watcher
- [ ] 4.6 Pass a development flag from the runner to `startApplication`; the kit enables `devtools` only when it is set
- [ ] 4.7 Confirm `ApplicationConfig` has no field capable of enabling DevTools, so a release cannot express the unsafe state
- [ ] 4.8 Add a kit test asserting the release path yields `devtools: false` and that no configuration value overrides it
- [ ] 4.9 Manually verify: edit `examples/file-explorer/src/ui/styles.css` while running and see the change without touching the terminal

## 5. The minimal application

- [ ] 5.1 Write `src/app/` — one window, one declared operation with a real validator, a button that calls it, and a rendered result. No filesystem access, no styling beyond the minimum, target roughly forty lines of application code
- [ ] 5.2 Give it its own window title and dimensions, and the template's default CSP
- [ ] 5.3 Register it in `app.config.ts` and make it the default application
- [ ] 5.4 `bun run dev` with no arguments opens the minimal application
- [ ] 5.5 Confirm the minimal application is **not** scanned by `verify:readonly` — the default application a clone opens is free to write, which is the read-only separation made observable
- [ ] 5.6 Add a kit test for `resolveApplication`: default when unnamed, the named application when named, a listing error when unknown
- [ ] 5.7 `bun run build` with no `--example` builds the minimal application under its own output name

## 6. Continuous integration

- [ ] 6.1 Add `.github/workflows/` running `bun test`, `bun run typecheck`, and `bun run verify:readonly`
- [ ] 6.2 Build both applications on macOS arm64
- [ ] 6.3 Build both applications on Linux x64, installing GTK/WebKitGTK development packages and compiling the native addon from source
- [ ] 6.4 Record the observed Linux job duration in the change notes — it is the baseline that justifies the prebuilt-addon change
- [ ] 6.5 Confirm a deliberately broken commit fails the workflow, then revert it
- [ ] 6.6 Replace the README's hardcoded "36 tests passing" badge with one reflecting the actual workflow result

## 7. Documentation

- [ ] 7.1 `README.md` Quick start — a clone now opens the minimal application; explain how to run and read the explorer
- [ ] 7.2 Project structure — `src/app/` is the minimal starting point, `examples/file-explorer/` is the worked example
- [ ] 7.3 Development commands table — add `--example <name>` and `--no-watch`
- [ ] 7.4 Document that DevTools are available in development and absent from releases
- [ ] 7.5 `docs/build-and-runtime.md` — application selection and the two build targets per application
- [ ] 7.6 Re-check that every path the README names resolves

## 8. Acceptance

- [ ] 8.1 `bun test` — 0 fail, no assertion lost against the 50 pass / 108 expectations baseline
- [ ] 8.2 `bun run typecheck` passes
- [ ] 8.3 `bun run verify:readonly` passes, scanning the explorer and not the minimal application
- [ ] 8.4 `bun run verify:performance` passes with no regression beyond noise
- [ ] 8.5 Both applications build on macOS arm64; the minimal one runs from an empty directory
- [ ] 8.6 A release executable has DevTools disabled
- [ ] 8.7 CI green on both supported targets
- [ ] 8.8 A fresh clone, `bun install`, `bun run dev` opens the minimal application, and its complete source reads in one sitting
