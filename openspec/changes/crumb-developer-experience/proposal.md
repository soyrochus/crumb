## Why

`extract-crumb-kit` made the boundary real: `src/kit/` has zero import edges into `src/app/`, and the kit typechecks with the application removed entirely. What it did not do is make the template pleasant to start from. A clone still opens a 900-line file browser, `scripts/dev.ts` is one-shot so every UI edit means closing the window and running again, `devtools: false` is hardcoded so there is no way to inspect the page you are building, and `.github/` holds prompt files but no workflow — the "36 tests passing" badge is a claim no machine checks.

Crumb now says it exists so you can ship a server-less web app as a desktop app. The first hour of doing that is the product, and right now that hour is spent reading someone else's file explorer and restarting a window.

## What Changes

- **`src/app/` becomes a minimal starting point** — one window, one declared operation, a button that calls it, in roughly forty lines. This is what a clone opens and what a new project edits.
- **The explorer moves to `examples/file-explorer/`**, intact, with its tests. It stops being the application the repository builds and becomes the worked example you read when you want to see something substantial. `bun run dev --example file-explorer` runs it.
- **`app.config.ts` gains application selection** — the build and dev loop target the application named in configuration or on the command line, so an example is a first-class build target rather than a directory you copy over `src/app/`.
- **Watch mode** — `bun run dev` rebuilds the UI artifact and restarts the host when a source file changes, with a clear line on each rebuild. `--no-watch` keeps the current one-shot behavior.
- **DevTools in development, never in release** — the kit enables them for `bun run dev` and forces them off for `bun run build`, regardless of configuration. A release artifact must not ship an inspectable WebView.
- **CI** — a workflow running `bun test`, `bun run typecheck`, `bun run verify:readonly`, and a build on macOS arm64 and Linux x64, so the badge means something.
- **`verify:readonly` follows the explorer** to `examples/file-explorer/`, and the minimal app in `src/app/` is deliberately *not* subject to it — demonstrating that the read-only rule belongs to the example, which is the point `retarget-crumb-as-template` made in prose.
- Documentation updated for the new first-run path.

**Not in scope:** the prebuilt Linux addon (its own change — hosting, checksum verification, and keeping the from-source path available are supply-chain decisions, not developer ergonomics), Windows support, multiple windows, and any change to the explorer's behavior.

## Capabilities

### New Capabilities

- `developer-workflow`: What the template guarantees about building *on* it rather than shipping from it — a minimal starting point rather than an example to delete, a fast edit-run loop, development-only diagnostics that cannot reach a release artifact, more than one selectable application in one repository, and automated verification of the supported targets.

### Modified Capabilities

None. Moving the explorer changes no requirement: `filesystem-browsing`, `file-preview`, and `three-pane-interface` already describe it as the example application without naming a path, and `filesystem-browsing` already scopes its static check to "the example application's source" rather than to `src/app/`. `desktop-shell` already takes window title and dimensions from application declaration, which is how two applications coexist.

## Impact

- **Code**: new `src/app/` (minimal); `examples/file-explorer/` receives today's `src/app/`; `scripts/dev.ts` gains a watch loop and an `--example` flag; `scripts/build.ts` and `scripts/ui-artifact.ts` resolve entries from the selected application; `src/kit/host/main.ts` and `src/kit/shared/config.ts` gain a development flag governing DevTools.
- **Tests**: `test/app/*` follows the explorer to `examples/file-explorer/test/`; new kit tests cover application selection and the release DevTools invariant. The suite must not lose an assertion — currently **50 pass, 108 expectations**.
- **CI**: `.github/workflows/` created. Linux CI must install GTK/WebKitGTK and build the native addon from source, which is slow — an accepted cost until the addon change lands, and the reason that change matters.
- **Docs**: `README.md` Quick start, Project structure, and Development commands; `docs/build-and-runtime.md`.
- **Risk**: `bun run dev` currently imports the host directly into its own process. A watch loop that restarts requires running the host as a child process instead, which is a real change to how development works and the most likely source of defects in this change.
