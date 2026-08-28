## Context

See `proposal.md` — Why.

Three facts about the current code shape this design.

`scripts/dev.ts` registers a Bun plugin and then does `await import("../main")`, running the host **in its own process**. That works for a one-shot launch and cannot work for a watch loop: there is no way to unload the imported module graph, and the native window owns the process until it closes. Watching requires the host to become a child process.

`src/kit/host/main.ts` hardcodes `devtools: false` in the `NativeWindow` options. Nothing in `ApplicationConfig` mentions DevTools, which is the right shape to keep — the flag must come from *how the process was started*, not from application configuration, or an application could ship an inspectable release.

`app.config.ts` names one application through `entries` and `outputStem`. Selection means turning that into a lookup over several applications, and `scripts/ui-artifact.ts`, `scripts/build.ts`, and `scripts/dev.ts` all read those entries today.

## Goals / Non-Goals

**Goals:**
- Make the first hour on the template good: a clone opens something you can read, and edits appear without a manual restart.
- Keep the release artifact strictly no worse: no DevTools, no configuration path that enables them, no new runtime dependency.
- Preserve every existing assertion. 50 pass / 108 expectations is the floor.

**Non-Goals:**
- Hot module replacement or state-preserving reload. Rebuild-and-restart is the goal; anything finer is a large increase in machinery for a small gain at this size.
- The prebuilt Linux addon — its own change.
- Changing the explorer's behavior. It moves and its tests move with it; nothing else.
- Supporting an arbitrary application directory outside the repository.

## Decisions

### Run the host as a child process, and make that the dev loop

`scripts/dev.ts` becomes a supervisor: build the UI artifact, spawn `bun run` on a small runner entry with the selected application, watch sources, and on change rebuild and restart the child.

*Why:* it is the only approach that can restart a native window without exiting the command, and it has a useful side effect — the development process stops sharing a process with the application, so a host crash reports cleanly instead of taking the watcher down with it.

*Trade-off:* the Bun plugin that resolves `app:ui` and `app:native` currently lives in the dev process and is registered before the import. As a child process, the runner must register it itself. This is the single most likely source of defects in the change and is why the task list verifies a plain run before adding any watching.

*Alternative considered:* keeping the in-process import and re-executing the whole command on change. Rejected — the terminal would lose its watcher on every rebuild, and Ctrl-C semantics get confusing.

### DevTools come from the launch path, never from configuration

The kit reads a development flag passed by the runner — not a field on `ApplicationConfig`. `scripts/build.ts` has no way to set it.

*Why:* the requirement is that no application configuration value can enable DevTools in a release. If the flag were a config field, that guarantee would rest on the build remembering to override it. Making it structurally absent from `ApplicationConfig` means a release build cannot express the unsafe state.

*Alternative considered:* `devtools: boolean` on `ApplicationConfig` with the build forcing `false`. Rejected for the reason above — it is a guarantee by convention rather than by construction.

### Applications are a registry keyed by name; `src/app/` is the default entry

`app.config.ts` exports a record of application name → configuration, plus which is the default. `src/app/` registers as the default; `examples/file-explorer/` registers alongside it.

*Why:* it makes "run the explorer" a name rather than a path, keeps output filenames derivable per application, and gives the "name an application that does not exist" scenario an obvious implementation — list the keys.

*Note:* each application keeps its own config object with its own title, dimensions, CSP, and operations. The explorer's window title stays `Crumb - File explorer demo`; the minimal application gets its own.

### The minimal application demonstrates the bridge, not a framework

One window, one declared operation that returns something real from the host, a button that calls it, and a rendered result — with a validator, so the operation shows the full declared-and-validated path rather than a bare ping.

*Why:* the minimal app is documentation that compiles. Its job is to show the one thing that is genuinely non-obvious about this template: how a page reaches the host safely. Anything else belongs in the explorer.

*Deliberately excluded:* styling beyond the minimum, state management, and any filesystem access — a minimal app that reads the filesystem would re-teach the read-only question this project just finished separating from the template.

### The read-only check follows the explorer, and the minimal app is not subject to it

`verify:readonly` scans `examples/file-explorer/`. `src/app/` is not scanned.

*Why:* `retarget-crumb-as-template` argued in prose that read-only belongs to the example. This makes it observable — the default application a clone opens is free to write, and nothing fails.

### CI builds on both targets and accepts a slow Linux job

The Linux job installs GTK/WebKitGTK development packages and compiles the native addon from source on every run.

*Why:* the alternative is not verifying Linux, which is worse for a project whose Linux path is its most fragile. The slowness is the concrete argument for the addon change and should be measured, not hidden — the task list records the observed job duration so that change has a baseline.

## Risks / Trade-offs

- **The child-process runner cannot resolve the virtual modules** → Highest-likelihood failure in this change. Mitigated by ordering: get a plain child-process run working and verified before any watching is added, so a plugin-resolution failure is never tangled with a watcher bug.
- **The watcher restarts on its own output** → Watch source directories only, never `dist/` or `.build/`, and debounce. A restart loop is obvious but wastes a debugging session if unanticipated.
- **Moving the explorer breaks its tests silently** → Its tests move with it in the same step, and the assertion count is checked immediately after. A drop means something was lost in the move.
- **DevTools leak into a release** → A kit test asserts the release path produces `devtools: false` and that `ApplicationConfig` has no field capable of changing it. This is the one new invariant worth an explicit test rather than a review.
- **Two applications drift apart** → CI builds both, so a change that breaks the explorer while the minimal app still works is caught.
- **`bun run dev` gains flags and becomes harder to explain** → Keep it to two: `--example <name>` and `--no-watch`. Both documented in the Development commands table.

## Migration Plan

No deployment. Work continues on `crumb-refactor`; each task group ends with a green suite and can serve as a rollback point.

1. Turn `app.config.ts` into a registry with the explorer as the only entry; verify nothing else changed.
2. Move the explorer to `examples/file-explorer/` with its tests; verify.
3. Add the child-process runner with no watching; verify a plain run and a build.
4. Add watching and the DevTools flag; verify.
5. Write the minimal application and make it the default; verify.
6. Add CI; verify it passes on both targets.
7. Documentation.
