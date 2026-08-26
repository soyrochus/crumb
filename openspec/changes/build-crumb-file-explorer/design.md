## Context

The repository currently contains only the product specification and OpenSpec configuration. Crumb will be a new local desktop application whose trusted Bun host performs filesystem inspection and whose native WebView renders application-owned HTML, CSS, and browser TypeScript. It must run without Bun, Node.js, a source checkout, network access, or a local application server.

The design crosses a native binding, an RPC trust boundary, two operating systems, untrusted filesystem content, and a standalone executable build. The selected `@nativewindow/webview` binding has passed native Wayland window, asynchronous IPC, Linux x64 compilation, and relocated single-file execution probes. macOS arm64 runtime verification remains platform-gated.

## Goals / Non-Goals

**Goals:**

- Make filesystem mutation impossible through the production host API.
- Provide responsive location discovery, directory navigation, and bounded previews.
- Treat paths, filenames, metadata, and file contents as untrusted data.
- Keep the UI framework-free and the application state transient.
- Produce and verify one executable for macOS arm64 and one for Linux x64.
- Isolate platform differences and make domain logic testable without a WebView.

**Non-Goals:**

- Windows, additional CPU targets, macOS application bundles, installers, signing, or notarization.
- File mutation, editing, launching, shell integration, persistence, telemetry, or networking.
- Search, automatic filesystem watching, multiple windows, tabs, or user-configurable sorting.
- Rich PDF, media, archive, Office, Markdown, HTML, JavaScript, or SVG rendering.

## Decisions

### Gate implementation on a native-shell feasibility slice

The first deliverable will open a native window, load embedded self-contained HTML, invoke a validated asynchronous RPC method, and compile/run on both required targets without adjacent application-owned files. Full feature work proceeds only after this slice passes.

This is preferred over building the domain layer first because native binding and packaging failure would invalidate the chosen architecture. The original `webview-bun` choice was replaced after its blocking event loop prevented Promise-returning RPC callbacks from settling. `@webviewjs/webview` was rejected because native Wayland window creation failed, and Butter was rejected because its published Linux shim directly depends on X11 and its compiled IPC framing was inconsistent. `@nativewindow/webview` is selected because its non-blocking pump completes asynchronous IPC on native Wayland and its Node-API addon can be embedded into Bun's standalone executable.

### Separate host, shared contracts, and browser UI

Production code will be divided into `src/host`, `src/shared`, and `src/ui`. The host owns all filesystem calls and WebView lifecycle. Shared code contains serializable contracts and pure validation helpers. The UI owns rendering and transient interaction state.

This boundary avoids a generic service framework while making it possible to statically review production host code for mutation APIs.

### Expose four narrow RPC operations

The host will bind `getPlatformInfo`, `getLocations`, `listDirectory`, and `getPreview`. Preview responses include complete item details, so a separate details request is unnecessary. Every request is runtime-validated and every response is a discriminated serializable value. Errors cross the boundary as normalized domain errors without stack traces.

A generic filesystem operation or read-file binding is rejected because it would weaken the read-only capability boundary and make security review harder.

### Use normalized absolute paths as identifiers

The host validates paths as non-empty absolute strings without NUL bytes and normalizes them using POSIX path APIs. Directory entry paths are constructed only with standard path functions. Navigation history is committed only after a listing succeeds.

Symlink entries preserve `targetKind` and `broken` metadata. Entering a symlink to a directory is allowed, but the displayed/current path remains the normalized lexical path so parent navigation matches what the user entered. No recursive traversal is performed.

Canonicalizing all paths with `realpath` was rejected because it makes history and parent navigation unexpectedly jump to a target's physical hierarchy.

### Model navigation and preview as latest-request-wins operations

The UI assigns monotonically increasing request IDs independently to directory and preview requests. A response updates state only if its ID and requested path still match current state. History mutations occur transactionally after successful directory responses. Loading and error state are likewise scoped to the current request.

This prevents slow storage, removed volumes, and rapid input from presenting stale content.

### Enumerate directories incrementally with a hard cap

The host uses asynchronous directory iteration, stops after observing 50,001 eligible entries, and returns at most 50,000 sorted entries with `truncated: true`. Hidden filtering happens during enumeration according to the request option. Metadata collection tolerates entries disappearing between enumeration and inspection.

DOM rows will be constructed in a fragment and committed in batches. Full virtualization is deferred unless verification shows visible failure at the 5,000-entry target.

### Classify and read previews under fixed byte limits

Preview classification uses entry type, a conservative extension map, and at most an 8 KiB sample for unknown regular files. Text reads at most 1 MiB and uses UTF-8 decoding with replacement for malformed sequences. Images larger than 25 MiB return metadata without payload; accepted images are returned as validated MIME-specific base64 data URLs.

SVG preview is disabled in the initial release and receives a generic metadata preview. HTML, Markdown, JavaScript, and all other text are inserted using `textContent`; no file content reaches `innerHTML` or an executable resource context.

### Harden the embedded document independently of rendering code

The self-contained UI includes a restrictive Content Security Policy. It permits only the bundled application script/style and image data required for previews, while denying connections, frames, objects, forms, navigation, and remote resources. No development-only bridge or debug binding is present in production.

Defense in depth is required because safe DOM APIs alone do not constrain future regressions or compromised content handlers.

### Resolve a deliberately small set of locations

Home is resolved through the runtime/OS API with `/` as fallback. Existing common directories are discovered relative to Home on macOS. Linux reads the XDG user-directory configuration when valid and otherwise checks conventional Home-relative candidates. Root is always exposed.

macOS additionally lists accessible children of `/Volumes`. Linux checks accessible mount directories below `/run/media/<user>`, `/media/<user>`, and `/mnt`, deduplicating normalized paths. Parsing all kernel mount tables is deferred because pseudo-filesystem filtering is distribution-sensitive and root satisfies the minimum reliable fallback.

### Keep state and resources ephemeral

The application writes no preferences, caches, history, telemetry, or logs to disk. Column sizes, hidden-file visibility, histories, and selection live only in browser memory. Production diagnostics go to stderr without file contents. The UI drops previous text strings and image data URLs when selection changes.

### Build self-contained UI first, then compile the host

The build script first bundles browser TypeScript, CSS, and symbolic assets into one HTML artifact. It then embeds that artifact in the host executable and compiles the host with Bun. The target entrypoint directly requires the literal platform-addon path because `@nativewindow/webview`'s dynamic package loader is not discoverable by Bun compilation. Development may read generated build output, but production must not resolve UI resources from the current working directory.

Required release builds run on their corresponding operating system until cross-compilation of the native binding is explicitly proven. Release verification checks file type, dynamic dependencies, absence of adjacent required assets, offline launch, and operation on a clean machine without Bun or Node.js.

## Risks / Trade-offs

- [A dynamically selected Node-API addon is omitted by Bun compilation] → Use a target-specific literal addon require, which is proven to embed and run after Linux relocation; verify the same pattern on macOS arm64.
- [Linux WebKitGTK availability varies by distribution] → Target and document distribution families that provide GTK 3 and WebKitGTK 4.1, force/verify native Wayland, and fail startup with an actionable stderr message rather than falling back to X11/XWayland.
- [Native WebView RPC may execute callbacks on a UI-sensitive thread] → Keep callbacks asynchronous, benchmark the feasibility slice, and move bounded filesystem work to a worker only if measurements require it.
- [Base64 image transport adds roughly one-third encoding overhead plus transient copies] → Enforce the 25 MiB file cap, release old payloads immediately, and lower the limit if memory verification fails.
- [Large directories still require metadata work for many entries] → Stop iteration at the cap, tolerate per-entry races, batch UI construction, and document truncation.
- [Lexical symlink navigation can expose cycles through repeated user navigation] → Never recurse automatically; each navigation is an independent bounded listing.
- [Raw executables provide limited macOS desktop identity] → Accept terminal-oriented developer distribution for version 1 and treat an `.app` wrapper as later packaging work.

## Migration Plan

This is a greenfield change with no persisted data or compatibility migration. Implementation proceeds through the feasibility gate, domain modules, UI integration, and per-platform release verification. If the feasibility gate fails, remove its disposable prototype code and revise this change before continuing; no user data rollback is required.

## Open Questions

- Which exact macOS and Linux versions/distributions constitute the clean-machine support matrix?
- Does the literal target-addon embedding pattern pass compilation, relocation, native runtime, and clean-machine verification on macOS arm64?
- Which exact Wayland compositors and Linux distribution versions constitute the support matrix beyond the proven development session?
