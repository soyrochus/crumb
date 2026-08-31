# Changelog

All notable changes to Crumb are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); Crumb is pre-1.0 in
spirit (status: alpha) but versions are tagged `v<major>.<minor>.<patch>` and a
tag triggers the release-verification workflow.

Supported targets for every release: **Linux x64 on native Wayland** and
**macOS arm64**. Windows, X11, and XWayland are not supported. Executables are
unsigned and are not packaged as installers or macOS `.app` bundles.

## [Unreleased]

### Changed

#### Crumbbrot renders across every CPU core

- `examples/crumbbrot/`'s `fractal-renderer` extension now renders rows in
  parallel on a pool of scoped threads sized by
  `std::thread::available_parallelism`, using only the standard library — no new
  dependency and no change to the operation contract or the pixels produced.
  Workers claim one row at a time rather than taking fixed blocks: rows crossing
  the interior of the set run to the full iteration limit while rows outside it
  escape after a few steps, so a static split strands most workers on cheap
  regions. On a 16-core Linux x64 host the measured viewports improved by 10.4x
  to 12.2x; a 1600×1200 deep zoom at the 2,000-iteration limit fell from about
  4.5 seconds to about 0.43 seconds.
- The cancellation generation is re-checked before every row rather than every
  eighth row, so `cancelRenders()` interrupts an in-flight render sooner. A panic
  inside a worker still surfaces through the existing `catch_unwind` guard when
  the thread scope joins.
- Three Rust tests added: the parallel render is byte-identical to a serial
  reference for both fractal modes, every row is written exactly once, and a
  superseded generation is refused.

#### Documentation restructured

- `docs/native-extensions.md` is new. The complete Rust walkthrough — toolchain
  setup, crate shape, a minimal working module, declaration, the development
  loop, the worked examples, and the trusted-code posture — moved out of section
  8 of `docs/how-to-build-a-desktop-app-with-bun.md`, where it had grown to 41%
  of a guide that is optional reading for TypeScript-only applications. Section
  numbering in the guide is unchanged, so existing links and anchors still
  resolve.
- The guide gains the interface material it lacked: the `app.ts` / `client.ts` /
  `state.ts` split that every worked application already uses, designing within
  the content security policy, coalescing and generation-checked rejection of
  stale bridge results, and how to move binary payloads across a JSON transport.
- `crumbbrot` is documented as a worked example for the first time; no guide had
  referenced it.
- Compile timings and dependency listings that duplicated `docs/verification.md`
  were dropped rather than moved, leaving that file the single record.

### Fixed

- `.gitignore` now covers `target/`. Crumb's build scripts redirect Cargo output
  to `.build/`, so a crate's own `target/` appears only when Cargo or
  rust-analyzer runs directly in a crate directory — untracked, large, and easy
  to commit by accident.
- Corrected the automated-test figures in `README.md`, which still reported 126
  tests and 336 expectations against a suite that now has 152 and 450.

## [1.0.1] - 2026-08-29

### Fixed

- Release verification failed on the Linux runner: the `native-extension cache
  safety` test runs `cargo build --release` of the probe crate several times and
  timed out under bun's 5000 ms default on a 2-vCPU CI runner. The
  Rust-compiling test file now sets a compile-sized timeout.
- Reduced redundant filesystem work in the `extract` test suite (the planned
  file set is computed once instead of per test) so it adds less load to the
  concurrently running suite.

No behavior, API, or artifact change — test configuration only.

## [1.0.0] - 2026-08-29

The release where Crumb becomes a complete template and toolchain: applications
can add native code, coding assistants get first-class guidance, and an existing
web-app repository can adopt Crumb without moving into a clone.

### Added

#### Rust native extensions

- Declare an application-owned Rust Node-API `cdylib` by logical name in
  `ApplicationConfig.nativeExtensions`. `bun run dev` and `bun run build`
  validate the declaration, run `cargo build --release --locked`, cache the
  artifact per source fingerprint + extension name + target + digest, watch the
  crate source, and embed it in the standalone executable. No adjacent `.node`
  file, no separate native-packaging workflow, no Rust toolchain beside the
  finished binary.
- Import a declared extension from trusted host code as `app:ext/<name>` — the
  same specifier on every platform. The WebView still reaches native code only
  through declared, validated operations.
- `bun run rebuild:extensions [--example=<name>]` forces a clean rebuild after a
  toolchain, linker, or dependency change. A failed native rebuild never leaves a
  stale or wrong-target artifact loaded.
- `native-probe` — a permanent, dependency-free end-to-end fixture
  (`examples/native-probe/`, `src/app/native/probe/`) that is the smallest
  proof of the mechanism and the reference for a new crate's shape.
- `registerShutdownHandler(name, fn)` from `src/kit/host/shutdown.ts`: cleanup
  handlers run once in registration order when the window closes, with failures
  reported without skipping later handlers and the whole phase bounded to three
  seconds.

#### New worked examples

- **`activity-monitor`** (`bun run dev --example=activity-monitor`) — the
  production-shaped native-extension example. An application-owned
  `system-monitor` crate (`sysinfo` + `napi-rs` async tasks) feeds three
  validated, read-only operations: a system snapshot, a whole-process list, and
  per-process detail. Sampling runs off the window event loop, overlapping
  refreshes are prevented, shutdown cancels in-flight work, and unavailable
  metrics stay visibly unavailable. Addon, embedded build, and executable-only
  relocation verified on Linux x64 and macOS arm64.
- **`crumbbrot`** (`bun run dev --example=crumbbrot`) — an interactive
  Mandelbrot and Julia-set explorer with a `fractal-renderer` Rust extension
  doing each coarse RGBA render asynchronously. Built end to end as the exercise
  for the three shipped agent skills, then used to correct them.

#### Agent skills

- A canonical, vendor-neutral `skills/` directory and one command,
  `bun run install:skills`, that installs the copies Claude, Codex, and Copilot
  each read (`.claude/skills/`, `.codex/skills/`, `.github/skills/`).
  `--target=<assistant>` narrows it, `--list` previews, and `--check` fails if a
  committed copy has drifted from `skills/`. Installation is additive and only
  ever touches the skills `skills/` contains.
- Shipped skills: `crumb-add-operation` (the four-file operation ceremony and
  its runtime validator), `crumb-add-native-extension`, `crumb-new-application`,
  and `crumb-adopt-existing-project`.

#### Bring Crumb into an existing project

- **`bun run extract -- --dest <project>`** — run from a Crumb clone, it stages
  every template-owned file into `<project>/crumb-source/` (kit, full pipeline,
  native patch, `main.ts`, `tsconfig.json`, the skills, and the template
  `docs/`), installs the Crumb skills into the project's assistant directories,
  and writes merge fragments plus a `MERGE.md` checklist. Outside `crumb-source/`
  it only ever adds `crumb-` skill directories — it never modifies an existing
  file and never touches the clone. `--dry-run` previews; `--force` re-stages.
- The `crumb-adopt-existing-project` skill then does the per-project merge: it
  assesses whether the project can become a Crumb application and either applies
  `crumb-source/`, proposes a staged migration, or explains the blocker — never a
  half-applied tree.
- [Brainflip](https://github.com/soyrochus/brainflip), a memory game with
  Node/Express and Python/Flask backends, was migrated this way entirely
  automatically in Claude Code: `extract`, then one "adopt Crumb" instruction.
  The walkthrough is [`specs/migrate-brainflip-to-crumb.md`](specs/migrate-brainflip-to-crumb.md).
- New living capability specs `openspec/specs/native-extensions/` and
  `openspec/specs/template-extraction/`.

#### Documentation and CI

- [How to build a desktop app with Bun](docs/how-to-build-a-desktop-app-with-bun.md) —
  the step-by-step walkthrough of the application structure, the browser-to-host
  bridge, native extensions, the development loop, and the standalone release
  build.
- `.github/workflows/verify.yml` — release verification. On a `v<major>.<minor>.<patch>`
  tag it runs the test suite and type check, compiles the Linux native addon
  from source, and builds the starter, `file-explorer`, `native-probe`, and
  `activity-monitor` on macOS arm64 and Linux x64. Day-to-day checking stays
  local (`bun test`, `bun run typecheck`, `bun run verify:readonly`).

### Changed

- `bun run build` and `bun run dev` own the native build stage. Do not run
  `cargo build` as a separate prerequisite.
- The development supervisor watches declared native-extension source and
  restarts the host process on a native change; native code is never
  hot-replaced in a running process, and a UI-only change reuses the verified
  artifact.
- `bun run build` names its artifact after the selected application
  (`dist/<app>-<target>`); `--output=<name>` overrides the stem.
- README and the living specs restructured around the template + toolchain
  framing, with the three-pane browser identified as the `file-explorer`
  example rather than as the project.

[1.0.1]: https://github.com/soyrochus/crumb/releases/tag/v1.0.1
[1.0.0]: https://github.com/soyrochus/crumb/releases/tag/v1.0.0
