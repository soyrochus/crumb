# Native Extensions for Crumb

**Status:** Discussion draft  
**Audience:** Crumb maintainers and application authors  
**Initial targets:** macOS arm64 and Linux x64 GNU  
**Recommended technology:** Rust compiled as Node-API addons with `napi-rs`  
**Distribution model:** One self-contained Crumb executable per target

## 1. Summary

Crumb applications should be able to use Rust where TypeScript is not the best
implementation language. Typical reasons include calling an existing Rust
library, performing CPU-intensive work, integrating with an operating-system
API, or implementing a capability that benefits from Rust's type and memory
safety.

Rust code will run inside the trusted Bun host process. It will be compiled as a
platform-specific Node-API addon (`.node`), loaded through a small TypeScript
facade, and embedded by Bun into the final standalone executable.

The browser UI will never load a native addon directly. It will continue to use
Crumb's declared and validated RPC channel:

```text
Native WebView UI
       │
       │ declared, validated RPC
       ▼
TypeScript operation handler
       │
       │ typed host-side call
       ▼
Rust Node-API addon
       │
       ▼
Pure computation, native library, or operating-system API
```

Native extensions are selected when an application is built. They are not
plugins that an end user installs into an already-built executable.

## 2. Goals

The native-extension design should:

- let an application implement selected host capabilities in Rust;
- preserve Crumb's narrow, declared, and validated browser-to-host boundary;
- embed required Rust addons in the target's standalone Bun executable;
- support both application-owned Rust source and reusable prebuilt addons;
- expose one stable TypeScript-facing API across supported platforms;
- keep applications that use only TypeScript unchanged;
- preserve the existing macOS arm64 and Linux x64 GNU release targets;
- make native dependencies, failures, and platform requirements explicit;
- provide a path for CPU-intensive work that does not block the UI thread.

## 3. Non-goals

The initial design will not provide:

- runtime installation of third-party native plugins;
- loading native code selected by a browser request or arbitrary filesystem
  path;
- a stable public binary plugin ABI independent of Node-API;
- sandboxing of native extensions inside the Bun process;
- automatic support for every Rust crate or operating-system target;
- arbitrary static linking of Rust object files into Bun itself;
- transparent cross-compilation where the native dependency chain has not been
  proven to support it;
- a replacement for TypeScript as Crumb's application configuration, RPC, and
  UI language.

## 4. Terminology

### Native extension

Trusted native code selected at build time and embedded into a Crumb
executable. In the initial design, a native extension is a Rust Node-API addon
plus a TypeScript facade.

### Application-owned extension

A Rust crate whose source is part of the application repository. It is compiled
as part of development or release preparation.

### Prebuilt extension

A reusable addon whose platform binaries were compiled and tested in CI before
the application installs them. The application developer does not need a Rust
toolchain merely to consume it.

### Runtime plugin

Code installed or discovered after the application executable has been built.
Runtime plugins are outside the initial scope because they require external
files, compatibility negotiation, provenance checks, permissions, and a new
trust model.

### Bun native plugin

A native extension to Bun's bundler, such as an `onBeforeParse` hook. This is a
build-tool concept and is not the general mechanism for calling Rust from a
running Crumb application.

## 5. Why Node-API

Bun can load Node-API `.node` addons directly and can embed a directly required
addon into a compiled executable. Crumb already relies on this behavior for its
Rust-based native WebView binding.

Node-API is the preferred boundary because it can represent functions, objects,
byte buffers, asynchronous work, and controlled callbacks without requiring a
hand-written C ABI for every feature. `napi-rs` provides Rust bindings and build
tooling for this model.

The first implementation should target a conservative Node-API level already
proven by Crumb's native WebView dependency. An addon is considered supported
only after it has been tested with Bun; compatibility with Node.js alone is not
sufficient acceptance.

## 6. Extension anatomy

An application-owned extension may use a layout such as:

```text
native/
└── image-processing/
    ├── Cargo.toml
    └── src/
        └── lib.rs

src/app/
└── native/
    └── image-processing.ts
```

The Rust crate compiles as a `cdylib` and exports selected functions through
Node-API. For example:

```rust
use napi_derive::napi;

#[napi]
pub fn calculate_score(values: Vec<f64>) -> f64 {
    values.iter().sum()
}
```

The TypeScript facade owns the application-facing contract:

```typescript
import native from "app:native/image-processing";

export function calculateScore(values: number[]): number {
  return native.calculateScore(values);
}
```

The virtual `app:native/...` import is illustrative rather than a final API.
Its purpose is to let Crumb select and embed the correct target artifact without
placing platform-specific paths in application code.

## 7. Host integration

Native extensions belong behind application operations. An operation will
continue to validate untrusted browser input before calling Rust:

```typescript
const operations = {
  calculateScore: {
    validate: validateScoreInput,
    handle: async input => calculateScore(input.values),
  },
};
```

This preserves the following rules:

- only explicitly declared operation names are reachable from the UI;
- browser input is validated in the trusted host before entering native code;
- the UI cannot import, enumerate, or call native extension exports directly;
- native results and failures are normalized before crossing back to the UI;
- adding Rust does not create a generic native, filesystem, shell, or FFI
  bridge.

An application may also call a native extension from other trusted host code
that is not exposed to the browser.

## 8. Application declaration

Crumb should eventually give applications a declarative way to select native
extensions. The exact TypeScript shape remains a design decision, but it should
distinguish source and prebuilt extensions explicitly. For example:

```typescript
nativeExtensions: {
  imageProcessing: {
    kind: "source",
    crate: "native/image-processing",
  },
  search: {
    kind: "package",
    package: "@example/native-search",
  },
}
```

The declaration is build-time configuration. It must not accept values supplied
by the WebView or values discovered from an end-user plugin directory.

Each logical extension name must be unique within an application. Unknown
extension kinds, missing artifacts, duplicate names, and target mismatches must
fail the build with an actionable error.

## 9. Development workflow

### TypeScript-only applications

An application with no native extensions must retain the current installation,
development, test, and build workflow. Rust and Cargo must not become global
prerequisites for every Crumb application.

### Application-owned Rust

An application that declares a source extension may require:

- a pinned or documented Rust toolchain;
- Cargo;
- a platform linker and relevant development headers;
- any native build tools required by its Rust dependencies.

The development runner should build a missing or stale addon before starting
the host. A change to extension source must rebuild the addon and restart the
host process; native addons must not be hot-reloaded into a process that already
loaded an older copy.

Rust compilation errors must stop or suspend application launch with the Cargo
failure visible to the developer. Crumb must not silently fall back to a stale
or differently targeted addon.

### Prebuilt Rust

A prebuilt extension should install the package matching the current operating
system, architecture, and Linux libc. Consuming a prebuilt extension should not
require Cargo, a Rust compiler, or an install-time download script beyond the
normal package-manager installation.

## 10. Release build pipeline

For an application with native extensions, the release pipeline becomes:

```text
1. Select application and target
2. Build or resolve every target-specific native extension
3. Verify extension architecture and declared native dependencies
4. Bundle the browser UI
5. Generate literal requires for the selected `.node` files
6. Compile the Bun host and embed the UI and native addons
7. Inspect and exercise the relocated standalone executable
```

Bun embeds a Node-API addon only when the build can discover the concrete file.
Crumb's build integration must therefore generate a statically analyzable,
literal `require()` for every selected target artifact. A runtime-computed
package or filename is not sufficient.

Conceptually, the generated module will resemble:

```typescript
const imageProcessing = require("/resolved/image-processing.darwin-arm64.node");
const search = require("/resolved/native-search.darwin-arm64.node");

export { imageProcessing, search };
```

These absolute build-machine paths are inputs to Bun's compilation step; they
must not remain as runtime filesystem dependencies in the resulting executable.

## 11. Target artifacts and portability

Native addons are platform-specific. The initial target matrix is:

| Crumb target | Rust/native artifact |
| --- | --- |
| macOS arm64 | Mach-O arm64 `.node` addon |
| Linux x64 GNU | ELF x64 GNU `.node` addon |

An extension must expose the same logical TypeScript API on every target it
claims to support. Platform-specific Rust implementations may use conditional
compilation internally.

Until independently proven otherwise, release addons should be built and tested
on their corresponding operating system. Pure Rust dependencies may make
cross-compilation practical, while crates that depend on operating-system
frameworks, C libraries, or generated bindings may not.

A native extension must declare every dynamic system dependency it introduces.
It must not silently raise Crumb's minimum macOS version, Linux distribution,
glibc requirement, WebView requirement, or CPU baseline. A deliberate increase
requires a documented application-level platform requirement.

## 12. Prebuilt package layout

A reusable extension should normally publish one small root package plus one
package per supported target:

```text
@example/native-search
@example/native-search-darwin-arm64
@example/native-search-linux-x64-gnu
```

The root package provides the TypeScript declarations and loader metadata. Each
platform package contains one `.node` artifact and declares appropriate `os`,
`cpu`, and, where relevant, `libc` constraints. Versions must be pinned exactly
across the root and platform packages.

Crumb's release build should resolve the concrete platform addon rather than
depending on a dynamic loader that Bun cannot statically analyze.

Prebuilt artifacts should be produced by a reproducible CI workflow, retained
as release artifacts, checksummed, and tested on the target platform before
publication.

## 13. Execution and threading

A native call executes in the Bun host process. A long synchronous Rust function
can therefore block the event loop and make the desktop window unresponsive.

Extensions must follow these rules:

- short computations may be synchronous;
- filesystem, network, or CPU-intensive work should use a Node-API asynchronous
  task, a worker, or another proven non-blocking design;
- Rust threads must not call JavaScript directly except through a supported
  thread-safe Node-API callback mechanism;
- APIs should prefer coarse operations over thousands of small calls across the
  JavaScript/native boundary;
- large byte payloads should use buffers or typed arrays instead of arrays of
  JavaScript numbers;
- cancellation and application shutdown behavior must be defined for
  long-running work.

## 14. Errors, panics, and process integrity

Expected native failures should become structured Node-API errors or explicit
result values. The TypeScript operation layer remains responsible for mapping
those failures to the application's serializable error contract.

A Rust panic, invalid pointer, data race in unsafe code, or native dependency
failure can terminate the entire Bun process. Native extensions are not
sandboxed merely because they are written in Rust.

Extensions must:

- avoid unwinding across the native interface boundary;
- use `Result` for expected failures;
- document any `unsafe` code and external native ownership assumptions;
- define ownership for returned buffers and native handles;
- release resources on normal shutdown and partial initialization failure;
- avoid storing JavaScript references beyond their valid lifetime;
- never treat untrusted browser data as validated solely because it crossed a
  TypeScript type boundary.

## 15. Security and trust

A native extension has the same operating-system permissions as the Crumb
process. It can read or modify memory, access the filesystem, invoke system APIs,
and crash the application. It is therefore trusted host code, not constrained
content.

The initial security model requires:

- extensions are selected explicitly by application source at build time;
- dependency versions and prebuilt artifacts are pinned;
- the WebView cannot supply an addon path or request arbitrary exported names;
- application RPC validators run before native calls;
- extension output is treated as untrusted until checked where appropriate;
- native dependencies are included in release inspection and documentation;
- a production build contains no generic `dlopen`, arbitrary FFI, or native
  module loading operation reachable from the UI.

Third-party native extensions require substantially more trust than ordinary UI
packages. Crumb should document that distinction prominently.

## 16. Single-executable distribution

Every addon required by the selected application and target must be embedded in
the standalone Bun executable. Copying only that executable to an otherwise
empty directory must remain sufficient to run the application.

The application must not require an adjacent `.node`, `.dylib`, `.so`, Rust
runtime, Cargo installation, package directory, or source checkout at runtime.
Operating-system libraries explicitly permitted by the supported target remain
valid dynamic dependencies.

The clean-machine acceptance journey must exercise at least one successful call
through every embedded native extension, rather than merely checking that the
window opens.

## 17. WebAssembly as a secondary Rust target

Rust compiled to WebAssembly is useful when a capability is pure computation
and does not need unrestricted operating-system access. Bun can embed a `.wasm`
file in a compiled executable and instantiate it from bytes.

WebAssembly may be preferable for:

- parsers and format decoders;
- search and indexing algorithms;
- compression and data transformations;
- portable computation shared by macOS and Linux;
- code that benefits from stronger isolation from native pointers.

It is less suitable for native windows, arbitrary system libraries, direct
operating-system integration, or APIs that require extensive host callbacks.
WASI support must be treated as a separately verified capability rather than
assumed to provide transparent native access.

WebAssembly modules still belong behind declared host operations. They must not
be loaded or selected by untrusted UI input.

## 18. FFI and sidecars

### Bun FFI

`bun:ffi` can call a Rust library that exports a C ABI, but Bun currently
describes this interface as experimental and recommends Node-API for production
native integrations. FFI also moves pointer, memory, callback, and type-layout
responsibility into application code.

FFI is therefore not the default extension mechanism. A future use must prove
standalone embedding, target behavior, memory safety, callbacks, failure
handling, and clean shutdown independently.

### Rust sidecar process

A separate Rust executable can provide crash isolation and independent process
scheduling. It also introduces process supervision, IPC framing, shutdown
coordination, executable extraction or adjacent files, and a larger attack
surface.

Sidecars are outside the initial native-extension design. They may be considered
later for untrusted parsing, especially failure-prone native libraries, or work
that must survive independently of the UI process.

## 19. Runtime-installable plugins

Build-time native extensions do not establish a runtime plugin ecosystem.
Supporting plugins installed after release would require decisions about:

- the plugin directory and lifecycle;
- signatures, provenance, and revocation;
- application and plugin API version negotiation;
- per-platform binary availability;
- permissions and user consent;
- crash containment and recovery;
- updates and dependency conflicts;
- whether external plugin files intentionally supersede the single-file
  distribution promise.

These questions should be addressed in a separate capability and threat model.

## 20. Verification

Each native extension should have proportionate verification at four levels.

### Rust-level verification

- `cargo fmt` and static analysis pass;
- Rust unit tests cover core logic and failure cases;
- unsafe blocks and external native interfaces receive focused tests;
- expected errors return normally rather than panic.

### Bun integration verification

- Bun loads the development addon successfully;
- the TypeScript facade matches the exported runtime API;
- synchronous and asynchronous calls return the expected values;
- malformed inputs fail without invoking unsafe work;
- repeated use and shutdown do not leak handles or leave work running.

### Target verification

- the addon architecture matches the selected target;
- dynamic dependencies are resolved and permitted;
- macOS minimum-version and Linux libc assumptions are recorded;
- the extension works on each target Bun runtime, not merely Node.js.

### Standalone verification

- Bun embeds every selected `.node` artifact;
- the standalone executable works after relocation without adjacent files;
- the acceptance journey invokes every extension successfully;
- missing system dependencies produce actionable startup or operation errors;
- applications with no native extensions retain their existing output and
  behavior.

## 21. Proposed delivery stages

### Stage 1: One application-owned proof

Add a small pure-Rust addon with one synchronous and one asynchronous operation.
Prove development loading, RPC integration, Bun embedding, relocation, and both
supported targets.

### Stage 2: Declarative source extensions

Add the application declaration, build ordering, stale-artifact detection,
watch/restart behavior, verification commands, and clear toolchain diagnostics.

### Stage 3: Prebuilt packages

Prove platform-specific optional packages, CI publication, exact versioning,
target selection, checksums, and compiler-free consumption.

### Stage 4: Reusable extension authoring guidance

Document API design, buffers, asynchronous work, error conversion, platform
dependencies, and release verification for extension authors.

Runtime-installable plugins are not an automatic fifth stage; they require a
separate product and security decision.

## 22. Open questions

- What exact `ApplicationConfig` shape should declare native extensions?
- Should source extensions be rebuilt automatically or only by an explicit
  command?
- Should Crumb generate TypeScript declarations from Rust exports or require an
  explicit handwritten facade?
- Which Node-API version should be the minimum supported contract?
- Where should prebuilt target packages be published and retained?
- Should every extension provide a small metadata export containing its API
  version and build identity?
- How should asynchronous extension work receive cancellation when the main
  window closes?
- What native dependency policy should reusable extensions satisfy?
- Is a portable WebAssembly extension type useful enough to include in the same
  application declaration, or should it remain an ordinary application asset?

## 23. Acceptance criteria for the initial capability

The initial native-extension capability is complete when:

1. A Crumb application can declare an application-owned Rust extension.
2. The extension builds and loads during development on macOS arm64 and Linux
   x64 GNU.
3. A declared and validated UI operation can call the extension and receive a
   serializable result.
4. Long-running native work has a demonstrated non-blocking path.
5. `bun run build` embeds the correct target addon into the standalone
   executable.
6. The executable works after relocation without the addon, Rust, Cargo, Bun,
   Node.js, or the repository beside it.
7. Artifact inspection reports only permitted native dependencies.
8. TypeScript-only applications continue to develop and build without a Rust
   toolchain.
9. Native failures are controlled where possible and do not expose raw internal
   details to the WebView.
10. The implementation and documentation do not imply support for arbitrary
    runtime-installed native plugins.

## 24. References

- [Bun Node-API documentation](https://bun.com/docs/runtime/node-api)
- [Bun standalone executable and embedded addon documentation](https://bun.com/docs/bundler/executables)
- [`napi-rs`](https://napi.rs/)
- [Bun FFI documentation](https://bun.com/docs/runtime/ffi)
- [Crumb standalone-distribution specification](../openspec/specs/standalone-distribution/spec.md)
- [Crumb desktop-shell specification](../openspec/specs/desktop-shell/spec.md)
