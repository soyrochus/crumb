## Purpose

How a Crumb application adds a capability implemented in a native language: how it declares one, how the toolchain builds and embeds it, what the application imports, and what the WebView is still forbidden to do because the application contains native code.

## ADDED Requirements

### Requirement: Declared native extensions
An application MAY declare native extensions as part of its configuration, each pairing a logical name with a source directory it owns. The declaration SHALL express intent only: it MUST NOT contain target-specific artifact paths, filenames, or build outputs, all of which the toolchain derives. Logical names SHALL be unique within an application. A declaration naming a missing source directory, an invalid manifest, or a duplicate name SHALL fail the build with a diagnostic identifying the offending declaration.

#### Scenario: Declare an extension
- **WHEN** an application declares a logical name and a source directory it owns
- **THEN** the toolchain builds that source for the selected target and makes it available to the application under that logical name, without the application naming any produced artifact

#### Scenario: Declare an unusable extension
- **WHEN** a declaration names a missing directory, an invalid manifest, or a name already declared
- **THEN** the build fails immediately, identifies which declaration is at fault, and produces no executable

#### Scenario: Declare nothing
- **WHEN** an application declares no native extensions
- **THEN** its development and release commands require no native toolchain and behave exactly as they would without this capability

### Requirement: Toolchain-owned native build
The toolchain SHALL own compilation, artifact location, and loading of a declared extension. An application author SHALL NOT be required to invoke the native build directly, locate or rename a produced artifact, write a target-specific load expression, or arrange embedding. An explicit rebuild command MAY exist for diagnostics and forced rebuilds, but MUST NOT be a required step in the ordinary development or release workflow.

#### Scenario: Develop with an extension
- **WHEN** a developer runs the development command for an application declaring an extension whose artifact is missing or stale
- **THEN** the toolchain builds it, verifies the expected artifact was produced, and starts the application with it loaded — without a separate command

#### Scenario: Native build fails
- **WHEN** compilation, linking, or a native dependency fails
- **THEN** the original diagnostics remain visible, the workflow stops, and the toolchain does not load a stale artifact, substitute an artifact built for another target, or continue with the capability silently missing

### Requirement: Stable application-facing import
An application SHALL reach a declared extension through a stable logical module name derived from its declaration. Application source MUST NOT contain artifact paths, platform suffixes, or conditional per-platform imports. The logical name SHALL resolve identically on every target the extension supports, and MUST NOT be branded with the project name.

#### Scenario: Import an extension
- **WHEN** application code imports a declared extension by its logical name
- **THEN** the exported functions are callable with ordinary language values, and the same source builds and runs unchanged on every supported target

#### Scenario: Inspect application source for artifact paths
- **WHEN** application source is reviewed for native artifact references
- **THEN** no path, platform suffix, or per-target conditional import appears outside generated build input

### Requirement: Extensions are embedded in the standalone executable
Every extension an application declares SHALL be embedded in that application's executable for the selected target. The relocated executable MUST NOT require an adjacent native artifact, a native toolchain, or the source tree. Build-machine paths MUST NOT survive as runtime dependencies.

#### Scenario: Relocate an executable with an extension
- **WHEN** only the executable of an application declaring an extension is copied to an otherwise empty directory
- **THEN** it launches and its extension-backed functionality works, with no adjacent artifact and no native toolchain present

#### Scenario: An extension widens platform requirements
- **WHEN** an extension introduces a dynamic library, a higher minimum operating-system version, a libc requirement, or a CPU requirement
- **THEN** release verification reports it, and it is recorded as an application-level platform requirement rather than being absorbed silently

### Requirement: Native extensions do not widen the WebView boundary
Declaring a native extension SHALL NOT change what the WebView can reach. The WebView MUST NOT be able to enumerate extensions, name or select one, load an artifact by path, or invoke a native export directly. Native capability SHALL be reachable only through the application's declared and validated operations, and input originating in the WebView SHALL be validated before any native code receives it.

#### Scenario: Call native capability from the page
- **WHEN** the page invokes a declared operation whose handler calls a native extension
- **THEN** the input is validated first, the native result is normalized into the application's serializable contract, and no other native entry point becomes reachable

#### Scenario: Attempt to reach native code directly
- **WHEN** page content attempts to enumerate native modules, request one by name or path, or invoke a native export
- **THEN** no such interface exists and the attempt fails as an undeclared operation

### Requirement: Native code is trusted host code
A native extension SHALL be documented as running in the trusted host process with the process's full operating-system permissions, able to read and write files, open network connections, and terminate the process. Static checks that scan application source in the host's own language SHALL be documented as making no claim about native code, so that an application combining such a check with an extension is not presented as verified beyond what was actually checked.

#### Scenario: Read the capability boundary documentation
- **WHEN** an author reads what a source-level capability check guarantees
- **THEN** the documentation states that the check does not analyze native extensions, and that an application declaring one must review that code separately

### Requirement: Native work must not block or outlive the window
An extension SHALL support both short synchronous calls and non-blocking work, and the application SHALL be given a way to run shutdown work before the process exits. Long or blocking native work MUST NOT be performed on the path that services the window, because the host owns the window's event loop and blocking it freezes the user interface. Termination SHALL NOT leave native threads or resources running unmanaged.

#### Scenario: Perform expensive native work
- **WHEN** an operation performs CPU-intensive or blocking native work
- **THEN** it runs without blocking the window, and the interface stays responsive while it completes

#### Scenario: Close the window during native work
- **WHEN** the window closes while native work is outstanding
- **THEN** registered shutdown work runs before the process exits, and native threads and handles are released rather than abandoned
