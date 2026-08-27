# standalone-distribution Specification

## Purpose
TBD - created by archiving change build-crumb-file-explorer. Update Purpose after archive.

## Requirements

### Requirement: Reproducible two-stage build
`bun run build` SHALL bundle the browser HTML, CSS, TypeScript, icons, and assets into a self-contained UI artifact and then compile the host, shared code, UI artifact, production dependencies, and Bun runtime into a standalone executable.

#### Scenario: Run a release build
- **WHEN** a developer runs `bun run build` in a configured target build environment
- **THEN** both stages complete in dependency order and produce the target executable without requiring Node.js or a frontend deployment

### Requirement: Required target artifacts
The initial release SHALL produce separate `macOS arm64` and `Linux x64` executables. Builds SHALL run on the corresponding operating system unless native-binding cross-compilation has been independently proven.

#### Scenario: Build the release matrix
- **WHEN** release workflows complete for both required targets
- **THEN** the distribution contains one correctly named executable for macOS arm64 and one for Linux x64

### Requirement: Single application-owned runtime file
Each target executable SHALL contain the Bun runtime, host and UI code, target-specific `@nativewindow/webview` Node-API binding, and all application-owned assets. It MUST NOT require adjacent application-owned HTML, CSS, JavaScript, image, `.node`, `.dylib`, `.so`, Bun, Node.js, npm, or source files. The build SHALL reference the target-specific native addon through a statically analyzable literal so Bun embeds it.

#### Scenario: Relocate the executable alone
- **WHEN** only the executable is copied to an otherwise empty directory on a compatible machine
- **THEN** it launches and provides its complete application-owned functionality

### Requirement: Permitted operating-system dependencies
The executable MAY dynamically depend on native libraries supplied by the supported operating-system environment. Linux runtime documentation SHALL state the exact supported distribution families and required GTK 3, WebKitGTK 4.1, and transitive system packages for the selected `@nativewindow/webview` build. Crumb SHALL force the Wayland GDK backend and SHALL NOT connect to an X server or fall back to X11/XWayland. Distribution-supplied GTK/WebKitGTK libraries MAY retain dormant linkage to X11 compatibility libraries.

#### Scenario: Required Linux library is absent
- **WHEN** the Linux executable starts without a required native WebView library
- **THEN** startup fails cleanly with an actionable dependency message and does not fall back to Chromium, a browser tab, or a local server

### Requirement: Artifact inspection
Release verification SHALL inspect executable type and dynamic dependencies using platform-appropriate tools and SHALL confirm that every dependency is either an allowed operating-system library or a documented native runtime prerequisite.

#### Scenario: Inspect a Linux artifact
- **WHEN** `file` and `ldd` are run against the Linux x64 artifact
- **THEN** it is identified as the intended ELF architecture and has no unresolved or adjacent application-owned dependency

#### Scenario: Inspect a macOS artifact
- **WHEN** `file` and `otool -L` are run against the macOS arm64 artifact
- **THEN** it is identified as the intended Mach-O architecture and links only permitted system frameworks or documented prerequisites

### Requirement: Clean-machine acceptance
Each required executable SHALL be tested on a supported clean machine without Bun, Node.js, npm, the source repository, or network access. The machine MAY contain only the documented native WebView and operating-system libraries.

#### Scenario: Exercise the clean-machine journey
- **WHEN** the executable is launched on its clean target machine
- **THEN** it opens a window, navigates directories, previews text, previews an image, handles an unsupported file, and exits successfully

### Requirement: Verification commands
The repository SHALL provide `bun test`, `bun run typecheck`, and build verification guidance. Tests SHALL cover domain logic, limits, invalid RPC inputs, path handling, symlinks, races where practical, hostile content, and platform location fallbacks using isolated temporary data.

#### Scenario: Run the standard verification suite
- **WHEN** a developer runs the documented test and typecheck commands on a supported development system
- **THEN** strict TypeScript checks and all applicable automated tests complete without modifying user-owned files
