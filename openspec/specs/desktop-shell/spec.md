# desktop-shell Specification

## Purpose
TBD - created by archiving change build-crumb-file-explorer. Update Purpose after archive.

## Requirements

### Requirement: Supported native desktop shell
The application SHALL run through Bun and `@nativewindow/webview` using the operating system's native WebView on macOS and Linux, and SHALL reject unsupported operating systems with a clear startup error. Linux SHALL use native Wayland and SHALL NOT require or fall back to X11/XWayland.

#### Scenario: Start on a supported platform
- **WHEN** the executable starts on a supported macOS or Linux system with required native libraries
- **THEN** it opens one resizable native window titled "Crumb" with an initial size of 1200 by 760 pixels and a minimum size of 800 by 500 pixels

#### Scenario: Start in a Linux Wayland session
- **WHEN** the Linux executable starts with a working Wayland compositor and the documented GTK/WebKitGTK libraries
- **THEN** it opens and remains functional without an X11 display, XWayland, or X11-only helper library

#### Scenario: Start on an unsupported platform
- **WHEN** the executable starts on an unsupported operating system
- **THEN** it reports that the platform is unsupported and exits cleanly without creating application state

### Requirement: Embedded offline user interface
The production application SHALL load all application-owned HTML, CSS, JavaScript, icons, and assets from content embedded in the executable, SHALL NOT depend on the source tree or current working directory, and SHALL NOT start a local server or access the network.

#### Scenario: Launch without repository or network
- **WHEN** the executable is launched from an arbitrary directory while networking is unavailable and the source repository is absent
- **THEN** the complete user interface loads and remains usable without filesystem asset lookup or network requests

### Requirement: Narrow read-only RPC surface
The host SHALL expose only `getPlatformInfo`, `getLocations`, `listDirectory`, and `getPreview` to application UI code. It MUST NOT expose generic filesystem operations, arbitrary byte reads, shell execution, or mutation operations.

#### Scenario: Inspect registered bindings
- **WHEN** the production host's WebView bindings are enumerated or statically reviewed
- **THEN** only the four declared read-only operations are available to the UI

### Requirement: Runtime RPC validation
The host SHALL validate every RPC input at runtime, accepting filesystem paths only when they are non-empty absolute strings without NUL bytes, and SHALL normalize successful results and failures into serializable contract values.

#### Scenario: Reject malformed path input
- **WHEN** a path-taking RPC receives null, undefined, an empty string, a relative path, a NUL-containing string, an array, or an object
- **THEN** it returns a controlled validation error and no filesystem operation is attempted

#### Scenario: Normalize a filesystem failure
- **WHEN** a valid RPC request encounters a filesystem error
- **THEN** the UI receives a domain error code and safe message without a raw stack trace

### Requirement: Ephemeral operation
The application SHALL keep preferences, navigation history, selection, pane widths, and preview data in memory only and SHALL NOT create application-owned preferences, caches, databases, telemetry, recent-file lists, history files, or disk logs.

#### Scenario: Exit after normal use
- **WHEN** the user browses files, changes pane widths, toggles hidden files, and closes the window
- **THEN** the process terminates normally without persisting application-owned state

### Requirement: Clean lifecycle
The application SHALL release WebView resources and cancel or disregard irrelevant pending work when its window closes, and a failure to initialize the native WebView SHALL produce an actionable startup error.

#### Scenario: Close the main window
- **WHEN** the user closes the application window during an outstanding preview request
- **THEN** the pending result is not applied, resources are released, and the process exits normally
