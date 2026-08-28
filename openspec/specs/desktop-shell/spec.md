# desktop-shell Specification

## Purpose
Template promise. The native window, embedded offline document, declared-and-validated request channel, restrictive document policy, and lifecycle behavior that every application built on Crumb receives without having to write them itself.

## Requirements

### Requirement: Supported native desktop shell
The application SHALL run through Bun and `@nativewindow/webview` using the operating system's native WebView on macOS and Linux, and SHALL reject unsupported operating systems with a clear startup error. Linux SHALL use native Wayland and SHALL NOT require or fall back to X11/XWayland. Window title, initial size, and minimum size SHALL be taken from the application's own declaration rather than fixed by the template.

#### Scenario: Start on a supported platform
- **WHEN** the executable starts on a supported macOS or Linux system with required native libraries
- **THEN** it opens one resizable native window using the title and dimensions the application declared, and enforces the declared minimum size

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

### Requirement: Narrow declared RPC surface
The host SHALL expose to application UI code only the operations the application explicitly declares, and each declared operation SHALL be reachable by name through a single validated request channel. The host MUST NOT expose a generic filesystem binding, arbitrary byte reads, shell execution, an eval-style bridge, or any operation absent from the declaration. Whether the declared operations read, write, or otherwise act is the application's decision and is not constrained by the template.

#### Scenario: Inspect registered bindings
- **WHEN** the production host's WebView bindings are enumerated or statically reviewed
- **THEN** only the application's declared operations are reachable from the UI, and no generic or undeclared capability is present

#### Scenario: Request an undeclared operation
- **WHEN** UI code or injected content requests an operation the application did not declare
- **THEN** the request is rejected as unknown, no handler runs, and the failure is reported as a controlled error

#### Scenario: Declare a writing operation
- **WHEN** an application declares an operation that modifies the filesystem or other external state
- **THEN** the template routes and validates it exactly as it does a reading operation, and imposes no read-only restriction of its own

### Requirement: Runtime RPC validation
The host SHALL validate every RPC input at runtime, accepting filesystem paths only when they are non-empty absolute strings without NUL bytes, and SHALL normalize successful results and failures into serializable contract values.

#### Scenario: Reject malformed path input
- **WHEN** a path-taking RPC receives null, undefined, an empty string, a relative path, a NUL-containing string, an array, or an object
- **THEN** it returns a controlled validation error and no filesystem operation is attempted

#### Scenario: Normalize a filesystem failure
- **WHEN** a valid RPC request encounters a filesystem error
- **THEN** the UI receives a domain error code and safe message without a raw stack trace

### Requirement: Restrictive document policy
The production UI SHALL apply a Content Security Policy that blocks remote connections, frames, object embedding, forms, unintended navigation, and non-application scripts, permitting only the resources the embedded application requires. The template SHALL supply this policy by default, and an application MAY widen it only through its own explicit declaration.

#### Scenario: Local content attempts network access
- **WHEN** malicious displayed content contains or resembles a remote resource URL
- **THEN** it remains inert text and the document policy prevents a connection from being established

#### Scenario: Build a new application on the template
- **WHEN** an application is built on the template without declaring any policy of its own
- **THEN** the restrictive default policy is applied to its embedded document

### Requirement: Ephemeral operation
The application SHALL keep preferences, navigation history, selection, pane widths, and preview data in memory only and SHALL NOT create application-owned preferences, caches, databases, telemetry, recent-file lists, history files, or disk logs.

#### Scenario: Exit after normal use
- **WHEN** the user browses files, changes pane widths, toggles hidden files, and closes the window
- **THEN** the process terminates normally without persisting application-owned state

### Requirement: Clean lifecycle
The application SHALL release WebView resources and cancel or disregard irrelevant pending work when its window closes, and a failure to initialize the native WebView SHALL produce an actionable startup error. Closing the window SHALL run any shutdown work the application or its extensions registered before the process exits, so that native threads, handles, and other resources are released rather than abandoned. Shutdown SHALL be bounded: work that does not complete within a defined limit MUST NOT prevent the process from exiting.

#### Scenario: Close the main window
- **WHEN** the user closes the application window during an outstanding preview request
- **THEN** the pending result is not applied, resources are released, and the process exits normally

#### Scenario: Close the window with shutdown work registered
- **WHEN** the window closes and the application or one of its extensions has registered shutdown work
- **THEN** that work runs before the process exits

#### Scenario: Shutdown work does not finish
- **WHEN** registered shutdown work does not complete within the defined limit
- **THEN** the process still exits, and the incomplete shutdown is reported rather than hanging the application
