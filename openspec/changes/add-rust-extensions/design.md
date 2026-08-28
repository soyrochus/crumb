## Context

See `proposal.md` — Why, and `specs/native-extensions-for-crumb.md` for the full discussion draft this change implements Stage 1 of.

Four facts about the current code shape the approach.

**The pipeline exists.** `scripts/build-native.ts` already performs the whole native build: fetch a pinned source, verify SHA-256, apply a patch at zero fuzz, `cargo build --release --locked` with an explicit `CARGO_TARGET_DIR`, copy the produced `.so` to a stable path, and return that path. `scripts/build.ts` then embeds it by generating `require(<literal>)` inside the `app:native` virtual module. This change generalizes that, it does not invent it.

**Half of it is Linux-only.** `buildNativeAddon()` throws on anything but `linux`/`x64`; on macOS the WebView addon arrives prebuilt through `node_modules`. So Crumb has *never* invoked Cargo on macOS. The embedding half is proven on both targets; the compiling half is proven on one. That inverts the intuitive risk ordering and drives the task sequence.

**Shutdown is `process.exit(0)`.** `src/kit/host/main.ts` ends window close with an immediate exit, which runs no cleanup at all. That is fine for pure TypeScript — nothing needs releasing — and inadequate the moment a Rust thread or file handle exists.

**Virtual modules are the established seam.** `app:ui`, `app:native`, and `app:selection` already carry build-time facts into the host through a Bun plugin registered in both `scripts/build.ts` and `scripts/runner.ts`. Extensions are a fourth instance of a pattern that works, including its known failure mode: the plugin must be registered in whichever process imports the host, which is what made the runner split delicate.

## Goals / Non-Goals

**Goals:**
- Prove one application-declared Rust crate end to end on both supported targets: declared, built, imported, embedded, and exercised from a relocated executable.
- Keep TypeScript-only applications completely untouched — no new toolchain requirement, no new step, no measurable slowdown.
- Make staleness and cache correctness a requirement, because native build cost is what will decide whether this is pleasant to use.
- Give the host a shutdown path that native code can hook.

**Non-Goals:**
- The Activity Monitor (Stage 2), reusable or prebuilt extensions (Stage 4), other backends or languages, FFI, WebAssembly, runtime plugins, cross-compilation. `specs/native-extensions-for-crumb.md` §4 fences these and this change adopts that fence unchanged.
- Generalizing the extension abstraction beyond Rust now. The declaration shape should not *prevent* another backend later, but designing for one is speculation.
- Sandboxing native code from the host process. It is trusted code; the honest response is to document that, not to imply containment.

## Decisions

### `app:ext/<name>`, not `crumb:native/<name>`

*Why:* `template-identity` — Project and example naming forbids branding identifiers exposed to application code; `crumb:ui` and `crumb:native` were renamed to `app:*` for exactly this reason in `extract-crumb-kit`. Separately, `app:native` already means the WebView binding, so extensions need their own namespace rather than a suffix on that one.

*Alternative considered:* generating a real TypeScript module under `.build/` and importing it by relative path. Rejected — it puts a generated path in application source, which the "Stable application-facing import" requirement forbids, and it is not statically discoverable in the way Bun's embedding needs.

### Crates live with their application, not in top-level `native/`

`src/app/native/<name>/`, `examples/<app>/native/<name>/`. Top-level `native/` remains the template's own pinned patch.

*Why:* the design draft's `native/<name>/` predates the registry. With several applications in one repository, a shared top-level directory cannot express which application owns a crate, and it contradicts the ownership boundary `extract-crumb-kit` established and `template-identity` requires. Co-locating also means deleting an application deletes its extensions.

### Split `build-native.ts` rather than parameterize it

The pinned-upstream WebView logic — fixed commit, fixed checksum, fixed patch — stays as it is. A separate builder handles application crates, which have none of those properties.

*Why:* they look similar and are not. The WebView addon is a checksum-pinned third-party fork the template vendors; an application extension is first-party source with no upstream, no patch, and no checksum. Forcing one function to do both would make each harder to read and would tempt an application crate into the pinned-source code path.

### Prove macOS first

The task order builds an extension on macOS arm64 before Linux x64.

*Why:* it is the unproven half. Linux already compiles Rust in this repository on every clean clone; macOS never has. Discovering a linker or toolchain problem on macOS after building the declaration model, the watcher, and the embedding would invalidate work in a way that discovering it first does not.

*Consequence for documentation:* the README currently promises macOS needs no Rust toolchain, C compiler, or Xcode. That stays true only for TypeScript-only applications and must be qualified.

### Shutdown becomes a bounded, registered phase

Window close stops accepting messages, runs registered shutdown handlers with a timeout, then exits.

*Why:* `process.exit(0)` cannot satisfy the "Native work must not block or outlive the window" requirement. The bound matters as much as the hook — an extension that hangs on shutdown must not make the window unclosable, which would be a worse defect than the one being fixed.

*Alternative considered:* leaving shutdown alone and documenting that extensions must not hold resources. Rejected as a guarantee by wishful thinking; threads are the ordinary case for the CPU-bound work extensions exist to do.

### Cache key covers declaration, target, and architecture

An artifact is used only when the toolchain can establish it belongs to this extension, this target, and this architecture.

*Why:* `build-native.ts` currently trusts any existing artifact at the expected path — its own comment in the README notes a copied working directory can inherit one. That is tolerable for a single pinned crate and not tolerable for N application crates across two targets, where a wrong hit produces a confusing runtime failure rather than a build error.

## Risks / Trade-offs

- **macOS Cargo invocation fails on a clean machine** → Highest-uncertainty item; sequenced first so it invalidates the least work. If the macOS toolchain requirement turns out to be heavier than expected, that is a finding worth having before anything else is built.
- **Build time makes the feature unpleasant** → CI is already tag-only because one Rust addon per target is slow; N extensions multiply it. Mitigated by treating staleness and caching as requirements, by not rebuilding native code for UI-only changes, and by measuring a rebuild's cost as an explicit task rather than assuming it is acceptable.
- **A stale or foreign-target artifact loads silently** → The worst failure mode, because it presents as a runtime bug far from its cause. Mitigated by the cache key above and by a test that a deliberately mismatched artifact is rejected rather than loaded.
- **The runner's plugin registration breaks again** → Same failure that made the child-process split delicate: the plugin must be registered in the process that imports the host. Mitigated by extending the existing plugin in both `build.ts` and `runner.ts` in one step and verifying a plain run before touching the watcher.
- **`verify:readonly` becomes misleading** → It scans TypeScript and cannot see into a crate, so an application with both a read-only policy and an extension is checked less thoroughly than its output claims. Mitigated by documenting the limit where the check is described; it is a documentation defect, not a code one.
- **The single-executable promise erodes quietly** → A crate pulling in a dynamic library would break relocation. Mitigated by making artifact inspection report extension dependencies and by exercising the extension from a relocated executable rather than only launching it.

## Migration Plan

No deployment. Each group ends with a green suite and a working build, so any group can be the rollback point.

1. Shutdown hook in the kit, with no extensions involved — it stands alone and is verifiable alone.
2. Declaration shape and validation, with no build yet.
3. A minimal crate built on macOS arm64, loaded in development.
4. The same on Linux x64.
5. Embedding, relocation, and artifact inspection.
6. Watching, staleness, and cache correctness.
7. Documentation, including the macOS toolchain qualification and the `verify:readonly` limit.

## Open Questions

- Whether the toolchain should generate TypeScript declarations from the crate's exports, generate only a loader and require a small handwritten facade, or support both. Deferrable: it changes ergonomics, not the build path or the task breakdown, and is better answered against a real crate than in advance.
- Which Node-API version to pin as the minimum supported contract. Deferrable to the first crate, where the answer is observable rather than guessed.
