# Native Extensions for Crumb

**Status:** Discussion draft  
**Audience:** Crumb maintainers and application authors  
**Initial targets:** macOS arm64 and Linux x64 GNU  
**Initial native language:** Rust  
**Initial integration technology:** Node-API via `napi-rs`  
**Distribution model:** One self-contained Crumb executable per target

## 1. Summary

Crumb should allow an application to add selected capabilities in Rust without turning native integration into a separate development workflow.

The intended developer experience is simple:

1. Add a Rust module to the application.
2. Declare it as a native extension.
3. Import its exposed API from TypeScript.
4. Run the normal Crumb development or build command.

Crumb takes care of the intermediate work: invoking Cargo, producing the target-specific native artifact, making it loadable from Bun, generating or resolving the application-facing binding, embedding the native module in the standalone executable, and verifying the resulting artifact.

Conceptually:

```text
Crumb application
├── Web UI                         HTML / CSS / TypeScript
├── Host operations               Bun / TypeScript
└── Native capability             Rust
        │
        │ handled by the Crumb toolchain
        ▼
   Node-API addon
        │
        ▼
   embedded in the same executable
```

The application author should normally work at the top of this model, not at the `.node` artifact level.

Rust is the first supported native-extension implementation because it is well suited to CPU-intensive code, operating-system integration, existing native libraries, concurrency, and code where strong memory-safety guarantees are useful.

This design does **not** introduce a new native-code mechanism to Bun. Bun already supports Node-API addons and can embed `.node` files in standalone executables. Crumb builds on that capability. The Crumb contribution is the application and toolchain integration that makes a Rust module feel like a normal part of a Crumb application rather than a separately built native component.

The longer-term intention is that Crumb should not unnecessarily restrict the native capabilities Bun can use. Existing Node-API modules, other Bun-supported native mechanisms, and additional implementation languages may be supported later. They are deliberately outside the first implementation. The first goal is to make the Rust path small, predictable, and seamless.

## 2. Design principle

The defining requirement is:

> A Crumb application author should be able to add a Rust module without manually managing the intermediate native build and packaging steps.

The author should not normally have to perform this sequence:

```text
cargo build
→ locate the correct .node artifact
→ copy or rename it
→ write a target-specific require()
→ update bundler configuration
→ keep host bindings synchronized
→ arrange standalone embedding
→ copy native files beside the final executable
```

Instead:

```text
native/system-monitor/
├── Cargo.toml
└── src/
    └── lib.rs
```

plus an application declaration should be sufficient for Crumb to incorporate the module into:

```text
bun run dev
```

and:

```text
bun run build --target=...
```

The native build chain remains real and visible when it fails, but it is owned by the Crumb toolchain rather than by routine application code.

## 3. Goals

The initial capability should:

- let a Crumb application implement selected host capabilities in Rust;
- make Rust modules part of the normal Crumb development and release workflow;
- hide target-specific `.node` paths and Bun embedding mechanics from application code;
- automatically compile application-owned Rust extensions when needed;
- expose a stable, typed TypeScript-facing API to the application;
- preserve Crumb's declared and validated browser-to-host RPC boundary;
- embed every required Rust extension in the final standalone executable;
- keep TypeScript-only applications unchanged;
- support synchronous and asynchronous native operations;
- preserve the existing macOS arm64 and Linux x64 GNU release targets;
- report Cargo, linker, target, and native-dependency failures clearly;
- verify that the relocated final executable works without adjacent extension files;
- establish an extension abstraction that can later accommodate other Bun-native mechanisms without requiring that generalization now.

## 4. Non-goals

The first implementation will not attempt to:

- create a new native ABI for Bun;
- replace Bun's Node-API support;
- wrap every native mechanism Bun supports behind one universal abstraction;
- make arbitrary existing npm native addons automatically into Crumb extensions;
- provide Bun FFI as an alternative extension backend;
- support Rust-to-WebAssembly as part of the native-extension mechanism;
- support arbitrary C, C++, Zig, Swift, or other source-language extensions;
- install native plugins at application runtime;
- load native code from an end-user-selected path;
- provide a stable binary plugin ABI independent of the Crumb build;
- sandbox native extensions from the Bun host process;
- support every Rust crate or operating-system target automatically;
- make cross-compilation transparent where the native dependency chain does not support it;
- replace TypeScript as Crumb's application, operation, validation, or UI language.

These may be separate future capabilities. They should not complicate the first Rust implementation.

## 5. Relationship to Bun

Bun already provides the low-level capabilities this design needs.

Bun can load Node-API `.node` modules directly. Bun's standalone executable builder can also embed directly referenced Node-API addons into the generated executable.

Crumb should therefore use Bun's existing native-module support rather than defining another runtime interop mechanism.

The relationship is:

```text
Rust source
    │
    │ Crumb automates
    ▼
napi-rs / Cargo
    │
    ▼
Node-API .node addon
    │
    │ Bun already supports
    ▼
Bun host
    │
    │ Bun --compile embeds
    ▼
standalone executable
```

Node-API is an implementation mechanism for the initial Rust backend. It is not intended to become the conceptual API exposed to Crumb application authors.

A developer should think in terms of:

```typescript
import { snapshot } from "crumb:native/system-monitor";
```

not:

```typescript
const addon = require(
  "../../.build/native/system-monitor/system-monitor.darwin-arm64.node"
);
```

The latter form may exist in generated build code, but it should not leak into ordinary application code.

## 6. Terminology

### Native extension

A native capability declared as part of a Crumb application and incorporated into its normal development and release build.

The abstraction is intentionally broader than its first implementation.

### Rust extension

The initial supported native extension type: application-owned Rust source compiled by Crumb and exposed to the Bun host through Node-API using `napi-rs`.

### Native backend

The toolchain implementation used to turn a native extension declaration into something the Bun host can call and Bun can package.

The first backend is Rust + Cargo + `napi-rs` + Node-API.

Other backends may exist later.

### Application-owned extension

A native extension whose source belongs to the application repository and is built as part of that application's development or release process.

Application-owned Rust extensions are the focus of the initial capability.

### Prebuilt extension

A native extension supplied as an already compiled platform artifact.

Prebuilt extensions may become useful later, but they are not required to prove the initial Rust authoring model.

### Runtime plugin

Code discovered or installed after a Crumb executable has been built.

Runtime plugins are a different feature. They require compatibility negotiation, provenance, permissions, updates, crash containment, and a different trust model.

## 7. Application layout

A Crumb application using Rust should be able to use a straightforward layout such as:

```text
src/
└── app/
    ├── operations.ts
    ├── index.html
    └── ...

native/
└── system-monitor/
    ├── Cargo.toml
    └── src/
        └── lib.rs
```

The Rust module belongs to the application repository. Its generated build artifacts do not.

A more explicit multi-extension layout could be:

```text
native/
├── system-monitor/
│   ├── Cargo.toml
│   └── src/lib.rs
└── search-index/
    ├── Cargo.toml
    └── src/lib.rs
```

The physical layout should remain conventional Rust. Crumb should avoid inventing a custom Rust project structure unless required by the build integration.

## 8. Application declaration

A Crumb application should explicitly declare the Rust modules that belong to it.

The exact configuration shape remains a design decision, but the initial form should be deliberately small. For example:

```typescript
export default defineApplication({
  nativeExtensions: {
    systemMonitor: {
      rust: "native/system-monitor",
    },
  },
});
```

or, if the extension abstraction needs an explicit backend:

```typescript
export default defineApplication({
  nativeExtensions: {
    systemMonitor: {
      kind: "rust",
      crate: "native/system-monitor",
    },
  },
});
```

The declaration should contain application intent, not generated artifact paths.

It must not contain:

```typescript
artifact: ".build/foo.darwin-arm64.node"
```

or other target-specific implementation details that Crumb can derive.

The declaration is build-time configuration. It must not accept extension paths supplied by the WebView or discovered from arbitrary user directories.

Each logical extension name must be unique. Missing crates, invalid manifests, duplicate names, unsupported targets, or conflicting outputs must fail the build with actionable diagnostics.

## 9. Application-facing API

The goal is for native functionality to look like an ordinary typed application module.

Conceptually:

```typescript
import {
  getSystemSnapshot,
  listProcesses,
} from "crumb:native/system-monitor";
```

The exact import convention is not yet fixed. `crumb:native/...` is illustrative.

Crumb may implement this through generated TypeScript bindings, a generated module map, a small handwritten facade, or a combination of these. The implementation should optimize for two properties:

1. application code must not contain native artifact paths;
2. the binding must remain statically discoverable by the Bun build.

The application-facing contract should use normal JavaScript/TypeScript values where practical:

- strings;
- numbers and booleans;
- serializable objects;
- arrays;
- `Buffer` or typed arrays for substantial binary data;
- promises for asynchronous work.

The native boundary should prefer coarse operations instead of thousands of fine-grained calls.

## 10. Rust authoring model

The Rust crate compiles as a `cdylib` and exports selected functions through `napi-rs`.

A minimal extension could resemble:

```rust
use napi_derive::napi;

#[napi(object)]
pub struct MemoryInfo {
    pub total_bytes: i64,
    pub used_bytes: i64,
}

#[napi]
pub fn memory_info() -> MemoryInfo {
    // platform/native implementation
    todo!()
}
```

The application author should be responsible for the Rust API and implementation, while Crumb owns how the resulting crate is integrated into the application build.

The author should not need a custom post-build copy script or platform-specific loader.

Crumb may require a small amount of conventional crate metadata so it can identify the produced library consistently. If additional metadata is needed, it should be deterministic and documented.

## 11. Development workflow

### TypeScript-only application

Nothing changes.

```text
bun install
bun run dev
```

must not require Rust, Cargo, a linker, or native development headers when the application declares no Rust extensions.

### Application with Rust extensions

The normal command remains:

```text
bun run dev
```

Crumb should:

1. inspect the application's native-extension declarations;
2. determine the current platform and architecture;
3. determine whether each Rust artifact is missing or stale;
4. invoke Cargo when necessary;
5. verify that the expected Node-API addon was produced;
6. generate or update the Bun-loadable binding;
7. start the normal Crumb host;
8. load the extension as part of that host.

The developer should not need to run a separate native build command before every launch.

An explicit command such as:

```text
bun run build:native
```

may still be useful for diagnostics, CI, or intentionally rebuilding all extensions, but it should not be a mandatory intermediate step in the normal workflow.

### Source changes

When Rust source changes during development, Crumb should rebuild the extension and restart the host process that loaded it.

A loaded native addon should not be hot-replaced inside the same process.

UI-only changes should retain the fastest development path available and should not trigger a Rust rebuild unnecessarily.

### Failures

Cargo errors, linker errors, unsupported-target errors, and missing native dependencies must stop or suspend application startup with the original useful diagnostics visible.

Crumb must never silently:

- use a stale native artifact after a failed rebuild;
- fall back to an artifact for another target;
- continue with the native capability missing;
- substitute a different extension implementation.

## 12. Build integration

The release command should remain the normal Crumb build command.

Conceptually:

```text
bun run build --target=macos-arm64
```

with a Rust extension becomes:

```text
1. Load application configuration
2. Resolve declared Rust extensions
3. Build each Rust crate for the selected target
4. Verify produced native artifacts
5. Generate the Bun-facing native module map
6. Bundle the Web UI
7. Build the Bun host
8. Embed the Rust Node-API addons
9. Produce one executable
10. Relocate and exercise the executable
```

The generated integration layer may internally resemble:

```typescript
const systemMonitor =
  require("/absolute/build/input/system-monitor.darwin-arm64.node");

export { systemMonitor };
```

This is generated build input, not application source.

Bun requires a concrete `.node` reference for reliable standalone embedding. Crumb should generate that concrete reference automatically from the extension declaration and selected build target.

Absolute build-machine paths must not remain runtime dependencies.

## 13. Single-executable invariant

Native extensions must preserve Crumb's principal distribution property:

> Copying the generated executable to an otherwise empty directory must be sufficient to run the application.

The released application must not require an adjacent:

- `.node`;
- `.dylib`;
- `.so`;
- Rust runtime;
- Cargo installation;
- source tree;
- `node_modules`;
- Bun installation.

Operating-system libraries that are explicitly part of the supported platform remain valid dependencies.

If a Rust crate introduces an additional dynamic library, framework, minimum operating-system version, libc requirement, or CPU requirement, that must be visible to the build and release verification.

The toolchain should prefer Rust dependencies that can be incorporated without weakening the single-executable model.

## 14. Host and WebView boundary

A native extension runs in the trusted Bun host process.

The browser UI must not gain a generic native-code interface merely because the application contains Rust.

The normal Crumb architecture remains:

```text
Native WebView UI
       │
       │ declared, validated RPC
       ▼
TypeScript operation handler
       │
       │ typed application call
       ▼
Rust extension
       │
       ▼
native computation / library / operating-system API
```

For example:

```typescript
const operations = {
  systemSnapshot: {
    validate: validateEmptyInput,
    handle: async () => getSystemSnapshot(),
  },

  processDetails: {
    validate: validateProcessDetailsInput,
    handle: async input => getProcessDetails(input.pid),
  },
};
```

The existing rules continue to apply:

- only declared operation names are reachable from the WebView;
- untrusted browser input is validated before invoking native code;
- the WebView cannot enumerate native modules;
- the WebView cannot select an addon path;
- the WebView cannot invoke arbitrary Rust exports;
- results and errors are normalized before crossing the RPC boundary;
- adding a Rust extension does not create a generic filesystem, shell, FFI, or native-code bridge.

Trusted host code may also call an extension directly when no browser operation is involved.

## 15. Example: Activity Monitor

A small Activity Monitor is a strong reference application for the first Rust extension capability.

It is easy to understand, visibly useful, and gives Rust a clear role without turning the entire application into a Rust project.

The application could show:

- overall CPU usage;
- total and used memory;
- load information where supported;
- process name and PID;
- per-process CPU usage;
- per-process memory usage;
- process state;
- parent process where available;
- disks or mounted volumes;
- network-interface information.

The UI remains an ordinary Crumb web application.

```text
┌───────────────────────────────────────────────────────────────┐
│ Activity Monitor                                    Refresh  │
├───────────────────────────────────────────────────────────────┤
│ CPU  27%       Memory  11.2 / 24 GB       Processes  438     │
├────────┬───────────────────────┬─────────┬─────────┬──────────┤
│ PID    │ Process               │ CPU     │ Memory  │ State    │
├────────┼───────────────────────┼─────────┼─────────┼──────────┤
│ 1843   │ Browser               │ 12.4%   │ 1.3 GB  │ Running  │
│ 921    │ Terminal              │  2.1%   │ 143 MB  │ Sleeping │
│ ...    │                       │         │         │          │
└────────┴───────────────────────┴─────────┴─────────┴──────────┘
```

The implementation split is straightforward:

```text
HTML / CSS / TypeScript
        │
        │ rendering, sorting, filtering, interaction
        ▼
Crumb operations
        │
        │ validation and application contract
        ▼
Rust system-monitor extension
        │
        ├── process enumeration
        ├── CPU and memory metrics
        ├── system information
        └── platform-specific native access where needed
```

A Rust crate such as `sysinfo` may provide much of the cross-platform implementation while allowing platform-specific code where necessary.

A possible Rust-facing API could be:

```rust
#[napi]
pub fn get_system_snapshot() -> SystemSnapshot {
    // ...
}

#[napi]
pub fn list_processes() -> Vec<ProcessSummary> {
    // ...
}

#[napi]
pub fn get_process_details(pid: u32) -> Option<ProcessDetails> {
    // ...
}
```

The corresponding application code should ideally be no more complicated than:

```typescript
import {
  getSystemSnapshot,
  listProcesses,
} from "crumb:native/system-monitor";

const snapshot = getSystemSnapshot();
const processes = listProcesses();
```

The example demonstrates the intended value of the extension model:

- the application is still fundamentally a Bun/TypeScript web application;
- a capability that benefits from native system access is implemented in Rust;
- the developer adds a Rust module rather than creating a separate native program;
- Crumb owns the Cargo-to-Bun integration;
- the final application remains one executable.

It also exercises important implementation concerns:

- repeated native calls;
- structured result conversion;
- platform differences;
- process and system APIs;
- potentially asynchronous sampling;
- native dependency inspection;
- release verification on both supported operating systems.

The Activity Monitor should be treated as an example of the model, not as a requirement that every native extension involve operating-system APIs.

## 16. Execution and threading

Native extension code executes inside the Bun host process.

A long synchronous Rust call can block the Bun event loop and make the application unresponsive. The extension model must therefore support both short synchronous calls and non-blocking work.

Rules:

- short bounded operations may be synchronous;
- CPU-intensive, filesystem-heavy, or blocking native work should use an asynchronous Node-API task, worker, or another proven non-blocking implementation;
- Rust threads must not call JavaScript directly except through a supported thread-safe Node-API mechanism;
- large binary payloads should use buffers or typed arrays;
- APIs should aggregate work rather than perform thousands of crossings of the native boundary;
- long-running operations must define cancellation or shutdown behavior;
- application termination must not leave native threads or resources unmanaged.

The Activity Monitor, for example, should avoid performing expensive process sampling synchronously on every UI event. Sampling can be performed as a bounded snapshot or through an asynchronous operation depending on measured cost.

## 17. Errors and process integrity

Expected native failures should return structured errors through Node-API or explicit result values.

The TypeScript layer remains responsible for converting these into the application's serializable error contract.

Examples include:

- permission denied;
- unsupported operating-system feature;
- process disappeared during inspection;
- invalid path;
- malformed native input;
- resource temporarily unavailable.

Rust does not make in-process native code harmless.

A panic, invalid pointer in `unsafe` code, faulty external library, or other native failure can terminate the entire Bun process.

Extensions should therefore:

- use `Result` for expected failures;
- prevent unwinding across the native interface boundary;
- document `unsafe` code;
- define ownership of buffers and handles;
- release resources during normal shutdown and partial initialization failure;
- avoid retaining JavaScript references beyond their valid lifetime;
- treat data from the WebView as untrusted until validated by the host layer;
- avoid unnecessary native dependencies.

## 18. Security and trust

A Rust extension is trusted host code.

It has the operating-system permissions of the Crumb process and can:

- read or modify files;
- access system APIs;
- allocate native memory;
- create threads;
- open network connections;
- invoke external native libraries;
- crash the application.

The initial security model therefore requires:

- extensions are declared explicitly in application source;
- only application-declared Rust crates are built into the application;
- the WebView cannot request a native module by path or name;
- normal Crumb RPC validation occurs before browser-controlled data reaches native code;
- extension output is validated where the application contract requires it;
- dependencies are version-pinned through the Rust dependency model;
- release verification reports unexpected dynamic dependencies;
- no generic native loader is exposed to browser operations.

The convenience of the Rust integration must not weaken Crumb's narrow browser-to-host trust boundary.

## 19. Target artifacts and portability

The first verified targets remain:

| Crumb target | Rust/Node-API artifact |
| --- | --- |
| macOS arm64 | Mach-O arm64 `.node` addon |
| Linux x64 GNU | ELF x64 GNU `.node` addon |

The same logical extension API should be available on every target an extension claims to support.

Platform-specific Rust implementation may use conditional compilation internally:

```rust
#[cfg(target_os = "macos")]
mod platform;

#[cfg(target_os = "linux")]
mod platform;
```

Crumb should not require the TypeScript application to import different modules for each platform.

Until proven otherwise for a dependency chain, native release artifacts should be built and tested on the corresponding target operating system.

Cross-compilation may be added where it is demonstrably reliable, but it is not part of the initial developer promise.

A Rust extension must not silently raise Crumb's:

- minimum macOS version;
- Linux/glibc requirement;
- CPU baseline;
- required system-library set.

Any deliberate change must become an application-level platform requirement.

## 20. Build caching and staleness

Native compilation is more expensive than TypeScript bundling, so Crumb should avoid unnecessary Rust rebuilds.

The toolchain should rebuild an extension when relevant inputs change, including at least:

- Rust source;
- `Cargo.toml`;
- `Cargo.lock` where present;
- target;
- build profile;
- relevant build configuration;
- generated bindings if they influence the native build.

The cache key must distinguish platforms and architectures.

A cached artifact is valid only if Crumb can establish that it belongs to the current extension definition and target.

A copied working directory must not cause Crumb to accidentally load an artifact built for another machine or target.

An explicit clean/rebuild command should be available for diagnostics.

## 21. Verification

Each Rust extension should be verified at several levels.

### Rust verification

As appropriate for the crate:

- formatting passes;
- static analysis passes;
- Rust unit tests pass;
- failure cases are tested;
- `unsafe` blocks receive focused review and tests;
- expected failures do not panic.

### Bun integration verification

- Bun loads the generated addon;
- generated or handwritten TypeScript bindings match the runtime exports;
- synchronous calls return correctly;
- asynchronous calls complete correctly;
- malformed application inputs fail predictably;
- repeated calls do not leak handles or leave native work running.

### Target verification

- the artifact architecture matches the selected target;
- dynamic dependencies are known and permitted;
- platform minimums are recorded;
- the extension is tested under Bun, not merely Node.js.

### Standalone verification

- every declared Rust extension is embedded;
- the executable works after relocation;
- no adjacent `.node` file is required;
- no Rust toolchain is required at runtime;
- the acceptance journey invokes each native extension rather than merely opening the window;
- TypeScript-only applications still produce their normal standalone executable.

For the Activity Monitor example, standalone verification should include retrieving at least one real system snapshot and one process list from the relocated executable.

## 22. Initial delivery stages

### Stage 1: Minimal Rust extension path

Implement one application-owned Rust crate.

Prove:

- automatic Cargo invocation;
- Node-API generation through `napi-rs`;
- development loading;
- application-facing TypeScript import;
- one synchronous operation;
- one asynchronous operation;
- standalone embedding;
- relocation;
- macOS arm64 and Linux x64 GNU.

The first proof should optimize for clarity rather than generality.

### Stage 2: Activity Monitor example

Build the Activity Monitor as the worked example.

Use it to prove:

- structured native return types;
- repeated native calls;
- OS-level capabilities;
- platform-specific behavior;
- useful error handling;
- non-blocking work where needed;
- a real application built from web UI + Bun host + Rust capability.

### Stage 3: Developer workflow

Add:

- extension declarations;
- stale-artifact detection;
- automatic rebuild;
- host restart on native changes;
- clean/rebuild commands;
- target diagnostics;
- dependency inspection;
- improved TypeScript binding ergonomics.

### Stage 4: Reusable Rust extensions

Only after the application-owned flow is stable, investigate reusable/prebuilt Rust extensions.

Questions include:

- package layout;
- target-specific artifacts;
- CI publication;
- checksums;
- exact versioning;
- Rust-toolchain-free consumption;
- API declaration and type distribution.

### Later: broader Bun-native support

Crumb should eventually consider how its application model can expose the other native options that Bun supports.

That may include:

- existing Node-API packages;
- additional native source languages that target Node-API;
- Bun FFI where appropriate;
- other future Bun-native mechanisms.

This is an architectural direction, not a requirement for the first Rust capability.

The initial implementation should avoid assumptions that make such evolution unnecessarily difficult, but it should not design or implement a universal native-extension framework prematurely.

## 23. Open questions

- What exact `ApplicationConfig` shape should declare a Rust extension?
- What should the application-facing import namespace be?
- Should Crumb generate TypeScript declarations from `napi-rs` exports, generate only a loader, or require a small handwritten TypeScript facade?
- How should Crumb identify the expected output artifact from a Rust crate without unnecessary configuration?
- Which Node-API version should be the minimum supported contract?
- What is the correct cache/staleness model for native builds?
- Should `bun run dev` rebuild Rust automatically on every relevant source change or only when the host is restarted?
- How should asynchronous native work receive cancellation when the main window closes?
- Which native dependencies are acceptable under the single-executable distribution promise?
- How should extension-specific platform requirements be surfaced to application authors?
- Which parts of the Activity Monitor should use portable Rust crates and which, if any, should deliberately demonstrate direct platform APIs?
- At what point should prebuilt Rust extensions become part of the supported contract?
- What minimum abstraction is required now so that other Bun-supported native mechanisms can be added later without redesigning application configuration?

## 24. Acceptance criteria for the initial capability

The first Rust native-extension capability is complete when:

1. A Crumb application can declare an application-owned Rust extension using application-level configuration.
2. The developer does not have to manually invoke Cargo before normal development or release builds.
3. Crumb automatically builds the extension for macOS arm64 and Linux x64 GNU.
4. Application TypeScript can import the extension through a stable logical module name without target-specific `.node` paths.
5. A declared and validated WebView operation can call the Rust extension and receive a serializable result.
6. Short synchronous native calls work.
7. Long-running native work has a demonstrated non-blocking path.
8. Rust compilation or linker failures stop the workflow with useful diagnostics.
9. Native source changes cannot silently leave a stale addon loaded.
10. `bun run build` embeds the correct target addon into the standalone executable.
11. The executable works after relocation without the addon, Rust, Cargo, Bun, Node.js, `node_modules`, or the repository beside it.
12. Artifact inspection reports only permitted native dependencies.
13. TypeScript-only applications continue to develop and build without a Rust toolchain.
14. The WebView cannot load, enumerate, or directly invoke arbitrary native modules.
15. The Activity Monitor example can retrieve real system information through the Rust extension from the relocated standalone executable.
16. The implementation does not present Node-API as a new Crumb technology; it is documented as the Bun-supported mechanism used by the initial Rust backend.
17. The implementation does not imply that Rust is the only native mechanism Crumb may ever support.

## 25. References

- [Bun Node-API documentation](https://bun.com/docs/runtime/node-api)
- [Bun standalone executable and embedded N-API addon documentation](https://bun.com/docs/bundler/executables)
- [`napi-rs`](https://napi.rs/)
- [Crumb standalone-distribution specification](../openspec/specs/standalone-distribution/spec.md)
- [Crumb desktop-shell specification](../openspec/specs/desktop-shell/spec.md)
