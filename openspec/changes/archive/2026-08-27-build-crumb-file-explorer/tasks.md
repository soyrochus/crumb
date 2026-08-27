## 1. Native Shell Feasibility Gate

- [x] 1.1 Initialize the Bun/TypeScript project with strict compiler settings, scripts, and pinned `@nativewindow/webview` dependency
- [x] 1.2 Build a minimal native Wayland window that visibly loads self-contained embedded HTML and completes an asynchronous validated RPC round trip without X11/XWayland
- [x] 1.3 Compile and relocate the Linux x64 feasibility executable, verifying that its visible UI runs without adjacent application-owned files
- [x] 1.4 Compile and relocate the macOS arm64 feasibility executable, verifying that it runs without adjacent application-owned files
- [x] 1.5 Record native dependencies, RPC responsiveness, external-navigation/devtools controls, and feasibility results; revise the design before proceeding if any architectural invariant fails

## 2. Shared Contracts and Host Foundation

- [x] 2.1 Create the `src/shared`, `src/host`, `src/ui`, `scripts`, and `test` module structure
- [x] 2.2 Define serializable platform, location, entry, item-details, preview-union, directory-listing, and domain-error contracts
- [x] 2.3 Implement runtime RPC argument validation and safe filesystem error normalization with unit tests for every invalid input class
- [x] 2.4 Implement supported-platform detection, primary-modifier reporting, path normalization, and startup-error handling
- [x] 2.5 Register only the four approved RPC bindings and add a static test that rejects generic reads, mutation APIs, and shell execution in production source

## 3. Read-Only Filesystem Browsing

- [x] 3.1 Implement asynchronous entry inspection with lstat-based kind, nullable metadata, readability, extension, and explicit symlink target/broken information
- [x] 3.2 Implement capped asynchronous directory iteration, hidden filtering, per-entry race tolerance, truncation signaling, and no recursive traversal
- [x] 3.3 Implement locale-aware case-insensitive natural ordering by directory, file, and other category
- [x] 3.4 Implement Home/root and existing common-directory discovery for macOS, including accessible `/Volumes` children
- [x] 3.5 Implement Linux XDG user-directory parsing, conventional fallbacks, and deduplicated discovery below `/run/media/<user>`, `/media/<user>`, and `/mnt`
- [x] 3.6 Add isolated filesystem and location tests for ordinary entries, hidden files, 50,000-entry capping logic, disappearing files, missing paths, permissions where practical, symlinks, broken links, and platform fallbacks

## 4. Preview Domain

- [x] 4.1 Implement item-detail collection and conservative extension/MIME classification without reading unsupported file bodies
- [x] 4.2 Implement at-most-8-KiB unknown-file text detection with binary controls and UTF-8 validity handling
- [x] 4.3 Implement 1-MiB bounded UTF-8 text previews with replacement decoding, truncation metadata, and complete item details
- [x] 4.4 Implement MIME-validated PNG, JPEG, GIF, and WebP data-URL previews with the 25-MiB pre-read limit
- [x] 4.5 Implement bounded direct-child directory counts and generic metadata previews, treating SVG and unsupported rich formats as generic
- [x] 4.6 Add preview tests for every discriminator, boundary size, malformed text, scripted SVG/HTML/JavaScript, unsupported binary content, and disappearing files

## 5. Application State and Navigation

- [x] 5.1 Implement transient UI state for locations, current directory, selection, histories, hidden visibility, pane widths, loading, and errors
- [x] 5.2 Implement transactional sidebar, child, parent, Back, and Forward navigation that commits path/history only after successful listings
- [x] 5.3 Add independent monotonically increasing directory and preview request guards so superseded responses cannot update state
- [x] 5.4 Implement selection, selection clearing, hidden-file re-enumeration, and release of superseded image/text preview payloads
- [x] 5.5 Add state tests for successful and failed history transitions, root parent behavior, lexical symlink navigation, and out-of-order responses

## 6. Three-Pane User Interface

- [x] 6.1 Build semantic application markup for the toolbar, navigation pane, directory pane, preview pane, splitters, and status area
- [x] 6.2 Render sidebar locations and batched directory rows with single selection, symbolic local icons, empty/truncated states, and accessible names
- [x] 6.3 Render directory, text, constrained image, and generic previews exclusively from the preview discriminator using safe DOM text operations
- [x] 6.4 Implement toolbar state, display-only path, item counts, selected path, loading placeholders, and normalized recoverable errors
- [x] 6.5 Implement pointer and accessible keyboard splitter operation with default and minimum pane widths
- [x] 6.6 Implement row keyboard navigation plus platform-specific parent, Back, Forward, hidden-toggle, Enter, and Escape shortcuts
- [x] 6.7 Add compact responsive styling, visible focus, non-color state cues, system typography, and live light/dark appearance
- [x] 6.8 Add and verify a restrictive production Content Security Policy and controls preventing external navigation, connections, objects, frames, forms, and unintended scripts

## 7. Host Integration and Lifecycle

- [x] 7.1 Connect the four UI RPC client methods to validated host bindings and validate response discriminators at the browser boundary
- [x] 7.2 Implement startup flow with early window creation, asynchronous location discovery, Home-to-root fallback, and initial listing
- [x] 7.3 Configure the native window title, initial/minimum dimensions, resizing, and clean close behavior on both supported platforms
- [x] 7.4 Ensure pending responses are ignored during shutdown and production diagnostics use stderr without file contents or raw UI stack traces
- [x] 7.5 Manually verify the required browse-and-inspect journey, resize behavior, keyboard-only operation, themes, removed items/volumes, and permission errors on macOS and Linux

## 8. Build, Verification, and Documentation

- [x] 8.1 Implement the two-stage Bun build that produces self-contained UI content and embeds it in the compiled host without runtime source-directory lookup
- [x] 8.2 Add standard test, typecheck, development, build, and target verification commands and ensure generated artifacts are ignored
- [x] 8.3 Add performance checks for startup, ordinary listings, previews, 5,000-row UI behavior, stale payload release, and bounded memory behavior
- [x] 8.4 Document supported macOS versions and Linux distribution families, exact GTK/WebKitGTK runtime packages, build prerequisites, and actionable startup failures
- [x] 8.5 Inspect Linux x64 output with `file` and `ldd`, verify offline clean-machine behavior without Bun/Node/source, and record results
- [x] 8.6 Inspect macOS arm64 output with `file` and `otool -L`, verify offline clean-machine behavior without Bun/Node/source, and record results
- [x] 8.7 Run the complete strict typecheck and automated test suite on both supported platforms and confirm tests modify only isolated temporary data
