## MODIFIED Requirements

### Requirement: Single application-owned runtime file
Each target executable SHALL contain the Bun runtime, host and UI code, target-specific `@nativewindow/webview` Node-API binding, every native extension the application declares, and all application-owned assets. It MUST NOT require adjacent application-owned HTML, CSS, JavaScript, image, `.node`, `.dylib`, `.so`, Bun, Node.js, npm, or source files. The build SHALL reference each target-specific native artifact — the WebView binding and every declared extension — through a statically analyzable literal so Bun embeds it.

#### Scenario: Relocate the executable alone
- **WHEN** only the executable is copied to an otherwise empty directory on a compatible machine
- **THEN** it launches and provides its complete application-owned functionality

#### Scenario: Relocate an executable that declares native extensions
- **WHEN** only the executable of an application declaring one or more native extensions is copied to an otherwise empty directory
- **THEN** it launches and its extension-backed functionality works without an adjacent native artifact or any native toolchain

### Requirement: Clean-machine acceptance
Each required executable SHALL be tested on a supported clean machine without Bun, Node.js, npm, the source repository, or network access. The machine MAY contain only the documented native WebView and operating-system libraries. The acceptance journey SHALL exercise window startup, the application's own primary interactions, every native extension the application declares, its error handling, and shutdown; the specific interactions are defined by the application under test rather than by the template.

#### Scenario: Exercise the clean-machine journey
- **WHEN** the executable is launched on its clean target machine
- **THEN** it opens a window, completes the application's declared primary interactions, exercises each declared native extension, handles its declared error cases, and exits successfully

#### Scenario: Exercise the file-explorer example
- **WHEN** the `file-explorer` example executable is the artifact under test
- **THEN** its journey covers navigating directories, previewing text, previewing an image, handling an unsupported file, and exiting successfully
