## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Restrictive document policy
The production UI SHALL apply a Content Security Policy that blocks remote connections, frames, object embedding, forms, unintended navigation, and non-application scripts, permitting only the resources the embedded application requires. The template SHALL supply this policy by default, and an application MAY widen it only through its own explicit declaration.

#### Scenario: Local content attempts network access
- **WHEN** malicious displayed content contains or resembles a remote resource URL
- **THEN** it remains inert text and the document policy prevents a connection from being established

#### Scenario: Build a new application on the template
- **WHEN** an application is built on the template without declaring any policy of its own
- **THEN** the restrictive default policy is applied to its embedded document

## REMOVED Requirements

### Requirement: Narrow read-only RPC surface
**Reason**: This requirement encodes one example application's decisions as a template guarantee — it enumerates the `file-explorer` methods `getPlatformInfo`, `getLocations`, `listDirectory`, and `getPreview`, and asserts that the host's surface is read-only. A template for desktop applications cannot promise that applications built with it never write. The durable template property is that the surface is narrow, declared, and validated.

**Migration**: Replaced by "Narrow declared RPC surface" in this same capability, which keeps the narrowness and validation guarantees without naming methods or asserting read-only-ness. The read-only character of the example's four methods is retained under `filesystem-browsing` → "Read-only filesystem implementation", where it belongs to `file-explorer`. No behavior of the running example changes.
