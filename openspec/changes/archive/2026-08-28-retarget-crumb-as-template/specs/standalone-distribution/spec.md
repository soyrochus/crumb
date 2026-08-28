## MODIFIED Requirements

### Requirement: Permitted operating-system dependencies
The executable MAY dynamically depend on native libraries supplied by the supported operating-system environment. Linux runtime documentation SHALL state the exact supported distribution families and required GTK 3, WebKitGTK 4.1, and transitive system packages for the selected `@nativewindow/webview` build. The built application SHALL force the Wayland GDK backend and SHALL NOT connect to an X server or fall back to X11/XWayland. Distribution-supplied GTK/WebKitGTK libraries MAY retain dormant linkage to X11 compatibility libraries.

#### Scenario: Required Linux library is absent
- **WHEN** the Linux executable starts without a required native WebView library
- **THEN** startup fails cleanly with an actionable dependency message and does not fall back to Chromium, a browser tab, or a local server

### Requirement: Clean-machine acceptance
Each required executable SHALL be tested on a supported clean machine without Bun, Node.js, npm, the source repository, or network access. The machine MAY contain only the documented native WebView and operating-system libraries. The acceptance journey SHALL exercise window startup, the application's own primary interactions, its error handling, and shutdown; the specific interactions are defined by the application under test rather than by the template.

#### Scenario: Exercise the clean-machine journey
- **WHEN** the executable is launched on its clean target machine
- **THEN** it opens a window, completes the application's declared primary interactions, handles its declared error cases, and exits successfully

#### Scenario: Exercise the file-explorer example
- **WHEN** the `file-explorer` example executable is the artifact under test
- **THEN** its journey covers navigating directories, previewing text, previewing an image, handling an unsupported file, and exiting successfully
