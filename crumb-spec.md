# Crumb - View-Only Three-Column File Explorer

> a tiny file explorer built with Bun.

## Product and Technical Specification

**Status:** Implementation specification
**Target platforms:** macOS and Linux
**Out-of-scope platform:** Windows
**Primary architecture:** Bun + TypeScript + native operating-system WebView
**Desktop binding:** `webview-bun`
**Distribution model:** Single self-contained executable per target platform and architecture
**Application class:** Local, view-only desktop file explorer

---

# 1. Purpose

Implement a small desktop file explorer for macOS and Linux using Bun and TypeScript.

Windows is explicitly out of scope for the current version.

The application provides a Finder-inspired three-column interface:

1. **Navigation column** — common filesystem locations.
2. **Directory column** — contents of the current directory.
3. **Preview column** — preview and metadata for the selected item.

The application is explicitly **view-only**.

It may:

* navigate directories;
* enumerate files and folders;
* inspect filesystem metadata;
* read files for preview purposes;
* display images;
* display text;
* display metadata for unsupported files.

It must not:

* create files;
* modify files;
* delete files;
* rename files;
* move files;
* copy files;
* change permissions;
* change ownership;
* create directories;
* execute files;
* invoke shell commands;
* launch selected files in other applications.

The application must be distributable as a **single executable containing the Bun runtime, application code, UI code, CSS, and required application assets**.

Bun must not be required on the destination system.

---

# 2. Product Goal

The product is intended as a deliberately small demonstration that a useful cross-platform desktop application can be implemented with:

```text
TypeScript
    +
Bun runtime
    +
native operating-system WebView
```

without Electron, package Chromium, Node.js, a local application server, or a separate frontend deployment.

The application should feel like a native lightweight desktop utility rather than a website running inside a window.

The objective is not to reproduce Finder or a Linux file manager.

The objective is to implement a coherent subset of common desktop file-browsing and preview behaviour with a substantially smaller application architecture.

---

# 3. Platform Scope

## 3.1 Supported platforms

The first release must support:

```text
macOS
Linux
```

The implementation must account for platform differences in:

* native window creation;
* WebView implementation;
* filesystem paths;
* home-directory resolution;
* common user directories;
* mounted-volume discovery;
* keyboard modifier conventions;
* system appearance;
* executable compilation targets;
* runtime library dependencies.

---

## 3.2 Windows

Windows is explicitly out of scope.

The implementation does not need to:

* compile for Windows;
* support Windows path semantics;
* support Windows drive letters;
* use WebView2;
* discover Windows libraries;
* implement Windows-specific keyboard shortcuts;
* provide Windows packaging.

The architecture should avoid unnecessary assumptions that would make future Windows support impossible, but Windows compatibility is not a current acceptance criterion.

---

# 4. Core Design Principles

## 4.1 View-only by construction

Read-only behaviour must not merely be a UI convention.

The backend architecture itself must expose no filesystem mutation operations.

No RPC function exposed to the WebView may provide generic filesystem access.

For example, the frontend must not receive an API such as:

```typescript
filesystem(operation, path, arguments)
```

Instead, the frontend receives a deliberately narrow capability surface such as:

```typescript
getLocations()
listDirectory(path)
getItemDetails(path)
getPreview(path)
```

None of these operations may mutate the filesystem.

This provides a stronger architectural guarantee than simply hiding Delete, Rename, or Save buttons.

---

# 5. Runtime Architecture

The application consists logically of two parts:

```text
┌─────────────────────────────────────────────────────┐
│              macOS or Linux application             │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Native WebView UI               │  │
│  │                                               │  │
│  │  HTML + CSS + browser TypeScript              │  │
│  │                                               │  │
│  │  Navigation | Directory | Preview             │  │
│  └──────────────────────┬────────────────────────┘  │
│                         │ RPC                        │
│  ┌──────────────────────▼────────────────────────┐  │
│  │              Bun host runtime                │  │
│  │                                               │  │
│  │  Navigation state                            │  │
│  │  Filesystem inspection                       │  │
│  │  Preview generation                          │  │
│  │  Security validation                         │  │
│  │  WebView lifecycle                           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

There is one application process from the application's perspective.

The WebView rendering implementation may use operating-system-controlled helper processes internally. Those are implementation details of the selected native WebView stack and are not packaged with the application.

---

# 6. Technology Stack

## 6.1 Runtime

Use Bun as:

* JavaScript runtime;
* TypeScript runtime during development;
* package manager;
* bundler;
* test runner;
* executable compiler.

Node.js must not be required at runtime or for normal development workflows.

---

## 6.2 Language

All application-owned executable code must be TypeScript.

TypeScript configuration must enable strict checking.

Minimum compiler expectations:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

`any` should not be used except when required at an external library boundary.

RPC inputs must always be runtime-validated even though TypeScript types exist.

---

## 6.3 Native WebView

Use `webview-bun` as the desktop binding.

The implementation must use the native WebView technology available on each supported operating system rather than package Chromium.

The exact native backend is platform-dependent:

| Platform | Native WebView expectation                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------- |
| macOS    | WebKit/WKWebView                                                                                         |
| Linux    | Native WebKit-based WebView, such as WebKitGTK, as supported by `webview-bun` and the target environment |

The application must not assume that macOS-specific WebKit APIs are available on Linux.

Platform-specific window and WebView behaviour must be isolated behind the desktop binding or a small host abstraction.

---

# 7. Desktop Window

Use `webview-bun`.

The native window contains a system WebView.

Application title:

```text
Explorer
```

Working title may be changed later without architectural impact.

Initial window size:

```text
1200 × 760 px
```

Minimum window size:

```text
800 × 500 px
```

Recommended initial position:

* centered on the primary display where supported;
* otherwise use the operating system's default window placement.

The window must be resizable.

The application must respond correctly to:

* resizing;
* high-DPI displays;
* macOS light mode;
* macOS dark mode;
* Linux desktop themes where exposed through the WebView or CSS media features.

The application must not require a specific Linux desktop environment for its core functionality.

---

# 8. Linux Runtime Requirements

Linux support depends on the native WebView implementation and its system libraries.

The application executable must contain:

* the Bun runtime;
* application code;
* UI code;
* CSS;
* application-owned assets.

It does not need to bundle operating-system WebView libraries or desktop system libraries.

The Linux release documentation must clearly state required runtime dependencies for supported distributions or distribution families.

Potential system dependencies may include:

```text
GTK
WebKitGTK
GLib
Cairo
Pango
GDK-Pixbuf
```

The exact dependency list depends on the `webview-bun` backend and build configuration.

The application must fail with a clear startup error if a required native WebView library is unavailable.

It must not silently fall back to a local HTTP server, package Chromium, or a browser tab.

---

# 9. UI Architecture

Do not introduce React, Vue, Angular, Svelte, or another component framework for the first implementation.

Use:

* semantic HTML;
* CSS;
* TypeScript;
* browser DOM APIs.

The interface is sufficiently small that a framework would add more structure than the application requires.

The browser-side code should nevertheless use explicit modules or components such as:

```text
App
NavigationPane
DirectoryPane
PreviewPane
Toolbar
Splitter
RpcClient
ApplicationState
```

These are architectural responsibilities, not necessarily classes.

---

# 10. Main Layout

The application contains:

```text
┌───────────────────────────────────────────────────────────────────┐
│ ◀︎  ▶︎     /home/user/Documents                           Explorer │
├───────────────┬────────────────────────┬──────────────────────────┤
│               │                        │                          │
│ NAVIGATION    │ DIRECTORY CONTENT      │ PREVIEW                  │
│               │                        │                          │
│ Home          │ 📁 Projects            │       [preview]          │
│ Desktop       │ 📁 Photos              │                          │
│ Documents     │ 📄 notes.txt           │       notes.txt          │
│ Downloads     │ 🖼 image.png           │                          │
│ Pictures      │ 📄 report.pdf          │       metadata           │
│               │                        │                          │
│ Volumes       │                        │                          │
│ ─────────     │                        │                          │
│ System        │                        │                          │
│               │                        │                          │
├───────────────┴────────────────────────┴──────────────────────────┤
│ 24 items                                      /home/user/notes.txt │
└───────────────────────────────────────────────────────────────────┘
```

The exact visual appearance must be inspired by common desktop file managers rather than attempting a pixel-for-pixel Finder reproduction.

The UI must not contain macOS-only terminology or assumptions in shared components.

---

# 11. Column Sizing

Default dimensions:

| Column     |   Default width |
| ---------- | --------------: |
| Navigation |          220 px |
| Directory  |          380 px |
| Preview    | remaining width |

Minimum widths:

| Column     | Minimum |
| ---------- | ------: |
| Navigation |  150 px |
| Directory  |  260 px |
| Preview    |  280 px |

The separators between the columns must be draggable.

Column widths are held in memory only.

They do not need to persist between application launches.

Double-clicking a separator may optionally restore the default width but is not required for version 1.

---

# 12. Toolbar

A narrow toolbar appears above the three panes.

It contains:

```text
[Back] [Forward]     Current Path
```

Optional future features such as search must not be implemented in version 1.

## 12.1 Back

Navigates to the previous directory in navigation history.

Disabled when no previous location exists.

## 12.2 Forward

Navigates forward after a Back operation.

Disabled when no forward location exists.

## 12.3 Path

The current directory path is displayed.

Examples:

```text
/Users/user/Documents/Projects
```

or:

```text
/home/user/Documents/Projects
```

The path is display-only in version 1.

It must not be implemented as an editable text field.

This deliberately avoids introducing another navigation mechanism into the initial application.

---

# 13. Navigation Pane

The left column contains navigation destinations.

The available destinations must be determined using platform-neutral filesystem APIs and platform-specific conventions.

---

## 13.1 Home

Always attempt to display the current user's home directory.

On Unix-like systems, resolve it using the appropriate runtime or operating-system API.

Do not hard-code a username.

Examples:

```text
/Users/user
```

```text
/home/user
```

The application must not rely exclusively on `process.env.HOME` without handling cases where the variable is absent or invalid.

---

## 13.2 Common User Directories

Display locations that actually exist on the machine.

Candidate locations:

```text
Desktop
Documents
Downloads
Pictures
Music
Videos
```

The implementation should use platform conventions where available.

On Linux, prefer the user's XDG user-directory configuration when available, such as:

```text
XDG_DESKTOP_DIR
XDG_DOCUMENTS_DIR
XDG_DOWNLOAD_DIR
XDG_PICTURES_DIR
XDG_MUSIC_DIR
XDG_VIDEOS_DIR
```

These values may be available through the environment or the user's XDG configuration.

On macOS, resolve the corresponding directories relative to the user's home directory.

Missing directories must simply be omitted.

The application must not create missing directories.

---

# 14. Volumes and Filesystem Roots

A second sidebar section shows available filesystem roots or mounted volumes.

The implementation must be platform-aware.

## 14.1 macOS

Candidate locations include:

```text
/
```

and:

```text
/Volumes
```

The root filesystem may be represented as:

```text
Macintosh HD
```

or:

```text
Computer
```

Mounted volumes under `/Volumes` may be displayed individually.

---

## 14.2 Linux

The implementation must not assume that `/Volumes` exists.

Candidate locations include:

```text
/
```

and mounted filesystems discovered through a platform-appropriate mechanism.

Possible sources include:

* `/run/media/<user>`;
* `/media/<user>`;
* `/mnt`;
* system mount information such as `/proc/self/mountinfo` or `/proc/mounts`.

The implementation should avoid displaying pseudo-filesystems and kernel interfaces as ordinary user volumes where practical.

At minimum, the root filesystem `/` must be available.

Mounted removable volumes may be displayed when they can be discovered reliably.

The exact volume-discovery strategy may vary by Linux distribution.

---

## 14.3 Dynamic Availability

The implementation must not assume that every discovered volume remains available.

External volumes may disappear while the application is running.

An unavailable destination must produce a recoverable UI error, never application termination.

---

# 15. Sidebar Selection

Selecting a navigation item performs a directory navigation.

The directory becomes:

```typescript
state.currentDirectory
```

Any previous item selection is cleared.

The directory pane is refreshed.

The preview pane displays the directory summary for the current directory until an item is selected.

---

# 16. Directory Pane

The middle column displays the immediate contents of the current directory.

The application does not display an expandable tree in this pane.

Only direct children are shown.

Example:

```text
📁 Source
📁 Documents
📄 README.md
📄 package.json
🖼 screenshot.png
```

---

# 17. Directory Entry Model

The backend returns directory entries using the following logical model:

```typescript
type EntryKind =
  | "directory"
  | "file"
  | "symlink"
  | "other";

interface FileEntry {
  name: string;
  path: string;
  kind: EntryKind;

  extension: string | null;

  size: number | null;

  modifiedAt: string | null;
  createdAt: string | null;

  hidden: boolean;
  readable: boolean;

  symlink: boolean;
}
```

Dates use ISO 8601 serialization.

`size` is `null` for entries where a meaningful byte size is not available.

The model must not assume that every platform provides a meaningful creation or birth time.

---

# 18. Directory Ordering

Default sort order:

1. directories;
2. files;
3. other entries.

Within each category sort by filename using locale-aware, case-insensitive natural ordering.

The following should sort naturally:

```text
file1
file2
file10
```

rather than:

```text
file1
file10
file2
```

The initial implementation does not need user-selectable sorting.

---

# 19. Hidden Files

Entries whose names begin with `.` are considered hidden on macOS and Linux.

Default:

```text
hidden files = not shown
```

Keyboard shortcut:

```text
Command/Ctrl + Shift + .
```

toggles their visibility.

The setting remains in memory for the lifetime of the application.

No preference file is written.

---

# 20. Item Selection

Single click selects an item.

Selection must:

1. update the visual selection state;
2. set `selectedPath`;
3. request details for the selected item;
4. request an appropriate preview;
5. update the Preview pane.

Only one item may be selected.

Multi-selection is explicitly out of scope.

---

# 21. Directory Navigation

A directory may be entered using:

* double-click;
* Enter;
* Right Arrow when appropriate.

Navigating into a directory:

```text
currentDirectory = selectedDirectory
selectedPath = null
```

and pushes the previous location onto Back history.

---

# 22. Parent Navigation

Keyboard shortcut:

```text
Command/Ctrl + Up Arrow
```

navigates to the parent directory.

The application must never generate an invalid parent above:

```text
/
```

Path handling must use the platform's native path semantics.

On the supported platforms, these are normally POSIX-style paths, but the implementation must still use standard path APIs rather than manual string manipulation.

---

# 23. Keyboard Navigation

The minimum keyboard interaction model is:

| Key                      | Behaviour                |
| ------------------------ | ------------------------ |
| Up                       | previous item            |
| Down                     | next item                |
| Home                     | first item               |
| End                      | last item                |
| Enter                    | enter selected directory |
| Command/Ctrl + Up        | parent directory         |
| Command/Ctrl + [         | Back                     |
| Command/Ctrl + ]         | Forward                  |
| Command/Ctrl + Shift + . | toggle hidden files      |
| Escape                   | clear selected item      |

Keyboard focus must remain visually identifiable.

The implementation must use the appropriate modifier for the current platform:

* `Command` on macOS;
* `Ctrl` on Linux.

---

# 24. Directory Pane Rows

Each item row contains:

```text
icon
filename
```

The first release should remain visually simple.

Optional secondary metadata may display:

```text
file size
```

or:

```text
modification time
```

but this is not required.

Avoid reproducing Finder's complete table view.

---

# 25. File Icons

Do not require extraction of native operating-system file icons in version 1.

Use application-owned symbolic icons.

Minimum categories:

```text
folder
text
image
archive
audio
video
pdf
generic-file
symlink
unknown
```

Prefer CSS/SVG icons that can be embedded in the application.

Do not introduce a large icon package merely for this purpose.

---

# 26. Preview Pane

The right column shows information about:

```typescript
state.selectedPath
```

If nothing is selected, it shows information about the current directory.

The Preview pane consists conceptually of:

```text
Preview content

File name

Kind
Size
Created
Modified
Path
```

Preview content changes according to file type.

---

# 27. Supported Preview Classes

Version 1 supports:

1. directories;
2. images;
3. text;
4. unsupported/generic files.

PDF, video, audio, archive decompression, Office documents and other rich formats are not required.

They receive metadata previews.

---

# 28. Image Preview

Minimum supported image formats:

```text
.png
.jpg
.jpeg
.gif
.webp
.svg
```

HEIC may be supported if it can be displayed reliably by the native WebView without adding a decoding dependency.

It is not mandatory.

The preview uses:

```css
object-fit: contain;
```

The image must:

* retain aspect ratio;
* fit inside the preview area;
* never enlarge the entire application layout;
* have an appropriate maximum width and height.

---

# 29. Secure Image Transfer

The frontend must not receive unrestricted `file://` filesystem URLs.

Instead:

1. the frontend requests a preview using a specific filesystem path;
2. the backend validates the request;
3. the backend reads the file;
4. the backend returns image bytes encoded in a safe transport representation;
5. the WebView renders those bytes.

A suitable representation is:

```text
data:<mime-type>;base64,<data>
```

For version 1 this is acceptable because preview sizes are deliberately bounded.

---

# 30. Image Size Limit

Maximum image file size for direct preview:

```text
25 MiB
```

This is a file-size limit, not a decoded-pixel-memory guarantee.

If the file exceeds the threshold:

```text
Preview unavailable

Image is too large for inline preview.

Name
Type
Size
Dimensions if available
Modified
Path
```

The application must not read arbitrarily large files into memory merely to produce a preview.

---

# 31. SVG Security

SVG is text-based and potentially contains active content.

SVG must not be inserted into the document using:

```typescript
element.innerHTML
```

Instead, if SVG preview is supported, treat it as an image resource through an `<img>` element using safely generated image data.

No SVG script must gain access to the application's page context.

If this cannot be guaranteed using the selected WebView mechanism, SVG image preview must be disabled and the file treated as generic/text content.

---

# 32. Text Preview

Text files are displayed in a scrollable monospaced preview.

Minimum explicitly supported extensions:

```text
.txt
.md
.json
.yaml
.yml
.toml
.xml
.csv
.log
.ini
.conf

.js
.mjs
.cjs
.ts
.tsx
.jsx

.rs
.go
.py
.rb
.java
.kt
.swift

.c
.h
.cpp
.hpp

.html
.css
.scss

.sh
.zsh
.bash
```

This list is advisory rather than exhaustive.

---

# 33. Text Detection

A file may be considered text if either:

1. its extension is on the known text extension list; or
2. its initial content appears to be valid UTF-8 text without significant binary control characters.

The backend should inspect at most the first:

```text
8 KiB
```

when performing content-based type detection.

Binary detection must not require reading the complete file.

The implementation must use a platform-independent text-decoding strategy.

---

# 34. Text Preview Limits

Maximum bytes read for a text preview:

```text
1 MiB
```

If the file exceeds 1 MiB, display:

```text
Showing first 1 MiB of 14.7 MiB
```

The preview is deliberately partial.

Do not implement an unlimited text editor-style buffer.

---

# 35. Text Rendering

Text must be inserted using safe text operations such as:

```typescript
textContent
```

Never inject file content into HTML using:

```typescript
innerHTML
```

Plain text is the default representation.

Markdown files must initially be displayed as Markdown source rather than rendered HTML.

HTML files must initially be displayed as source text rather than executed.

JavaScript must never be executed.

This is a critical security invariant.

---

# 36. Optional Syntax Highlighting

Syntax highlighting is not required.

If implemented later it must operate on escaped text and must not execute or interpret file content.

It must not require a heavyweight editor implementation.

Monaco Editor is explicitly out of scope for version 1.

---

# 37. Directory Preview

Selecting a directory displays:

```text
[folder icon]

Projects

Folder

24 items
Modified: 26 Aug 2026, 14:43
Path: /home/user/Projects
```

The application may count direct children.

It must not recursively scan the directory to calculate total size.

Recursive directory size calculation is explicitly excluded because it can cause uncontrolled filesystem traversal.

---

# 38. Generic File Preview

Unsupported files display:

```text
[generic icon]

filename.bin

Binary file

Size: 16.3 MB
Created: ...
Modified: ...
Path: ...
```

No attempt is made to interpret the content.

---

# 39. Metadata

The right pane should display the following fields where available:

```text
Name
Kind
Extension
Size
Created
Modified
Path
```

Optional:

```text
Symlink target
```

provided that showing the symlink destination requires no mutation and can be obtained safely.

The UI must gracefully omit metadata unavailable on the current operating system.

---

# 40. File Size Formatting

Use human-readable binary units:

```text
1.4 KiB
8.7 MiB
2.1 GiB
```

The exact byte count may optionally be shown as a tooltip.

Use base 1024 for:

```text
KiB
MiB
GiB
TiB
```

Do not label 1024-based values KB/MB.

---

# 41. Date Formatting

Internally use ISO 8601.

Display using the user's operating-system locale.

Example:

```text
26 Aug 2026, 18:43
```

or the corresponding system-local representation.

Do not hard-code a particular country format.

If a timestamp is unavailable, display an appropriate placeholder or omit the field.

---

# 42. Backend Responsibilities

The Bun host owns all filesystem access.

Suggested modules:

```text
src/
  host/
    main.ts
    filesystem.ts
    locations.ts
    preview.ts
    mime.ts
    rpc.ts
    errors.ts
    platform.ts
    types.ts
```

Responsibilities:

### `main.ts`

* application startup;
* WebView creation;
* RPC registration;
* UI loading;
* window lifecycle.

### `filesystem.ts`

* path inspection;
* directory enumeration;
* stat/lstat operations;
* safe reads.

### `locations.ts`

* Home;
* Desktop;
* Documents;
* Downloads;
* Pictures;
* Music;
* Videos;
* mounted volumes;
* platform-specific location discovery.

### `preview.ts`

* preview classification;
* text reading;
* image reading;
* preview limits;
* generic metadata.

### `mime.ts`

* MIME inference;
* extension classification.

### `rpc.ts`

* WebView binding registration;
* input validation;
* error normalization.

### `platform.ts`

* operating-system detection;
* keyboard modifier selection;
* platform-specific location discovery;
* platform-specific volume discovery;
* platform-specific startup and window behaviour where required.

### `errors.ts`

* domain-specific error model.

### `types.ts`

* shared backend domain types.

---

# 43. Frontend Responsibilities

Suggested layout:

```text
src/
  ui/
    index.html
    main.ts
    app.ts
    state.ts
    rpc.ts

    components/
      navigation-pane.ts
      directory-pane.ts
      preview-pane.ts
      toolbar.ts
      splitter.ts

    styles/
      base.css
      layout.css
      navigation.css
      directory.css
      preview.css
```

The exact file breakdown may be adjusted during implementation, but responsibilities must remain separated.

Do not create dozens of files for trivial elements.

---

# 44. Shared Contracts

Define RPC contracts in a shared source location where both backend and frontend types can import them.

Example:

```text
src/
  shared/
    contracts.ts
```

Core models:

```typescript
interface Location {
  id: string;
  label: string;
  path: string;
  kind: "home" | "favorite" | "volume" | "root";
}

interface DirectoryListing {
  path: string;
  entries: FileEntry[];
  truncated: boolean;
}

type Preview =
  | DirectoryPreview
  | ImagePreview
  | TextPreview
  | GenericPreview;
```

---

# 45. Preview Union

Use a discriminated union.

Example:

```typescript
interface DirectoryPreview {
  type: "directory";
  item: ItemDetails;
  itemCount: number | null;
}

interface ImagePreview {
  type: "image";
  item: ItemDetails;
  mimeType: string;
  dataUrl: string | null;
  tooLarge: boolean;
}

interface TextPreview {
  type: "text";
  item: ItemDetails;
  content: string;
  truncated: boolean;
  bytesRead: number;
  totalBytes: number;
}

interface GenericPreview {
  type: "generic";
  item: ItemDetails;
}
```

The frontend must render based exclusively on the discriminator.

Avoid complex type inference based on optional fields.

---

# 46. RPC Surface

Expose a deliberately narrow backend interface.

Conceptually:

```typescript
interface ExplorerApi {
  getPlatformInfo(): Promise<PlatformInfo>;

  getLocations(): Promise<Location[]>;

  listDirectory(
    path: string,
    options?: {
      showHidden?: boolean;
    }
  ): Promise<DirectoryListing>;

  getItemDetails(
    path: string
  ): Promise<ItemDetails>;

  getPreview(
    path: string
  ): Promise<Preview>;
}
```

`getPlatformInfo()` may provide:

```typescript
interface PlatformInfo {
  platform: "macos" | "linux";
  primaryModifier: "command" | "control";
  pathSeparator: "/";
}
```

No generic read-file RPC may be exposed to frontend JavaScript.

The frontend must not be able to request arbitrary byte ranges or invoke arbitrary backend functions.

---

# 47. RPC Validation

Every path received through RPC must be verified as:

```text
non-empty
string
absolute path
without NUL bytes
```

Normalize using the standard path APIs.

Never construct shell commands containing received paths.

Shell execution must not exist anywhere in the application.

---

# 48. Path Handling

Use the runtime's standard path APIs.

Never construct paths manually using string concatenation such as:

```typescript
directory + "/" + filename
```

Use:

```typescript
path.join()
path.resolve()
path.dirname()
path.basename()
```

as appropriate.

The implementation must not hard-code macOS-only path examples in path logic.

The supported platforms currently use POSIX-style paths, but path operations must still be delegated to standard APIs.

---

# 49. Symlinks

Symlinks must be handled explicitly.

Directory enumeration should use `lstat` semantics when determining that an item itself is a symbolic link.

A symlink must not be silently represented as a regular file without preserving that information.

Following a symlink for navigation is allowed.

Example:

```text
~/linked-project -> /mnt/data/project
```

If the target is a directory and the user enters it, navigation may resolve to the target.

Broken links display as unavailable items.

The application must not crash on:

* symlink loops;
* broken symlinks;
* inaccessible targets.

No recursive traversal means symlink loops should have little impact on version 1.

---

# 50. Filesystem Changes During Use

The filesystem may change independently while the application is running.

Examples:

* a file disappears;
* a directory is renamed externally;
* a mounted drive is removed;
* permissions change.

All operations must assume that a previously enumerated path may no longer exist.

Every file operation must handle race conditions such as:

```text
list item
→ external deletion
→ select item
→ stat returns ENOENT
```

The expected behaviour is a recoverable message and refresh.

---

# 51. Error Model

Normalize low-level filesystem errors into application errors.

Suggested model:

```typescript
type ErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "NOT_DIRECTORY"
  | "NOT_FILE"
  | "UNAVAILABLE"
  | "PREVIEW_TOO_LARGE"
  | "UNSUPPORTED"
  | "UNKNOWN";

interface ExplorerError {
  code: ErrorCode;
  message: string;
  path?: string;
}
```

Do not expose raw stack traces in the production UI.

---

# 52. Permission Errors

When the operating system refuses access, display:

```text
Unable to access this location.

The operating system denied permission.
```

Do not:

* retry continuously;
* invoke `sudo`;
* change permissions;
* attempt privilege escalation.

The application must respect operating-system security controls on both macOS and Linux.

---

# 53. Loading States

Directory navigation must immediately show a loading state if the operation is not instantaneous.

Example:

```text
Loading…
```

Preview requests similarly display a placeholder.

The UI must not appear frozen while reading a large directory or preview.

---

# 54. Async Behaviour

All filesystem operations potentially involving disk I/O should use asynchronous APIs.

Avoid synchronous filesystem operations on the main application path unless justified for very small startup configuration operations.

Directory loading and preview generation must not unnecessarily block the WebView event loop.

---

# 55. Stale Preview Protection

Consider:

```text
select A
request preview A

immediately select B
request preview B

preview B finishes
preview A finishes later
```

The UI must not accidentally display preview A.

Each frontend preview request must be associated with either:

```text
selection path
```

or:

```text
monotonically increasing request ID
```

Before applying the response, confirm that the selected item still matches the request.

---

# 56. Large Directories

The initial implementation should support ordinary directories containing thousands of entries.

Target:

```text
5,000 entries without visible UI failure
```

Reasonable target:

```text
10,000 entries
```

For unusually large directories, the application may display:

```text
This folder contains a very large number of items.
```

The first release does not need a sophisticated virtualized list, but DOM creation must be kept reasonably efficient.

A later implementation may introduce row virtualization.

---

# 57. Directory Enumeration Limit

To prevent pathological memory consumption, introduce a high safety limit:

```text
50,000 entries
```

If exceeded, the listing may be truncated and indicate:

```typescript
interface DirectoryListing {
  path: string;
  entries: FileEntry[];
  truncated: boolean;
}
```

The UI must clearly display that not all entries are shown.

---

# 58. Application State

The frontend owns transient UI state.

Example:

```typescript
interface AppState {
  currentDirectory: string;

  selectedPath: string | null;

  locations: Location[];

  entries: FileEntry[];

  backHistory: string[];
  forwardHistory: string[];

  showHidden: boolean;

  navigationWidth: number;
  directoryWidth: number;

  loadingDirectory: boolean;
  loadingPreview: boolean;

  directoryError: ExplorerError | null;
  previewError: ExplorerError | null;
}
```

State is in memory only.

---

# 59. No Persistent State

Version 1 must not create:

```text
preferences files
history files
databases
cache directories
recent-files lists
telemetry data
logs on disk
```

unless technically unavoidable by the operating system or WebView implementation.

Application-owned data should disappear when the process terminates.

This further reinforces the view-only design.

Console logging during development is acceptable.

Production logging should be limited to stderr and must not contain file contents.

---

# 60. Security Boundary

Treat all filesystem content as untrusted input.

This includes:

```text
file names
directory names
text files
HTML files
SVG files
JSON
Markdown
image metadata
symlink destinations
```

Never assume that locally stored files are safe.

A malicious file must not be able to execute JavaScript in the application UI.

---

# 61. HTML Content

If the selected file is:

```text
evil.html
```

and contains:

```html
<script>
  // malicious code
</script>
```

the application must display this as text.

It must never inject the file into the active DOM as HTML.

---

# 62. JavaScript Content

Selected `.js` or `.ts` files are data.

They must never be:

```text
imported
evaluated
executed
loaded as scripts
```

They are text preview only.

---

# 63. External Network Access

The application requires no network access.

Frontend code must not:

* load CDNs;
* load Google Fonts;
* fetch remote JavaScript;
* fetch remote stylesheets;
* fetch remote icons.

All resources must be embedded.

The application should remain completely usable with networking disabled.

---

# 64. Local HTTP Server

Do not create:

```text
localhost
127.0.0.1
Bun.serve()
Express
HTTP RPC
WebSocket RPC
```

for application communication.

The WebView should load embedded HTML directly.

Frontend/backend communication must use the WebView's native binding mechanism.

This avoids:

* port allocation;
* localhost attack surface;
* HTTP lifecycle management;
* an unnecessary server abstraction.

---

# 65. UI Packaging

The browser UI must be compiled into a self-contained HTML artifact during the build process.

Conceptually:

```text
src/ui/index.html
      ↓
Bun browser build
      ↓
self-contained ui.html
      ↓
embedded into host
      ↓
Bun standalone executable
```

CSS and frontend JavaScript should therefore ultimately be contained inside the generated HTML or embedded into the compiled executable in another equally self-contained manner.

No runtime lookup from the source directory is permitted.

---

# 66. Build Pipeline

The build should consist of two conceptual stages.

## Stage 1 — UI

Bundle:

```text
HTML
CSS
browser TypeScript
icons
```

into a self-contained frontend artifact.

## Stage 2 — Desktop Host

Compile:

```text
Bun host
shared application code
webview-bun
embedded UI
```

into the final executable.

The complete process should be exposed as:

```bash
bun run build
```

The build must produce artifacts for the supported target platform and architecture.

---

# 67. Development Commands

Recommended scripts:

```json
{
  "scripts": {
    "dev": "bun run src/host/main.ts",
    "build": "bun run scripts/build.ts",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

If `tsc` is used purely for static checking it may remain a development dependency.

Execution remains Bun.

---

# 68. Production Compilation

The production host compilation should use Bun standalone executable compilation.

Conceptually, macOS arm64:

```bash
bun build \
  --compile \
  --minify \
  --sourcemap \
  --target=bun-darwin-arm64 \
  src/host/main.ts \
  --outfile dist/explorer-macos-arm64
```

Conceptually, Linux x64:

```bash
bun build \
  --compile \
  --minify \
  --sourcemap \
  --target=bun-linux-x64 \
  src/host/main.ts \
  --outfile dist/explorer-linux-x64
```

The exact target list may be expanded for additional supported architectures.

The build script may use Bun's JavaScript build API instead of shell commands.

Prefer the JavaScript API if multiple build stages are needed.

---

# 69. CPU Architecture

The initial release should define explicit target artifacts.

Recommended targets:

```text
macOS arm64
macOS x64
Linux x64
Linux arm64
```

The minimum required release targets may be:

```text
macOS arm64
Linux x64
```

Additional architectures are optional but should be supported by the build design.

A universal macOS executable is not required for version 1.

If multiple architectures are required, produce separately compiled binaries rather than complicating the initial build.

---

# 70. Single Executable Requirement

The primary artifact for each target must be a single executable, for example:

```text
dist/explorer-macos-arm64
dist/explorer-linux-x64
```

and not:

```text
dist/
  explorer
  bun
  ui.html
  styles.css
  webview.dylib
  assets/
```

All application-owned runtime dependencies must be inside the executable.

Operating-system libraries and frameworks are naturally excluded from this requirement.

System dependencies such as the following are permitted:

```text
macOS:
  Foundation
  AppKit
  WebKit
  libSystem

Linux:
  GTK
  WebKitGTK
  GLib
  Cairo
  Pango
  GDK-Pixbuf
  libc
```

The exact dependency list depends on the native WebView implementation.

---

# 71. Single-Executable Verification

The build pipeline must include or document verification.

For macOS:

```bash
file dist/explorer-macos-arm64
```

Expected output should identify a Mach-O executable for the selected architecture.

Inspect dynamic dependencies:

```bash
otool -L dist/explorer-macos-arm64
```

For Linux:

```bash
file dist/explorer-linux-x64
```

Expected output should identify an ELF executable for the selected architecture.

Inspect dynamic dependencies:

```bash
ldd dist/explorer-linux-x64
```

Dependencies must resolve only to permitted operating-system libraries or dependencies known to be provided by the target environment.

No application-owned `.dylib`, `.so`, UI file, stylesheet, or asset directory beside the executable may be required.

---

# 72. Clean-Machine Verification

The executable must be tested on clean machines for each supported platform where:

```text
Bun is not installed
Node.js is not installed
npm is not installed
source repository is absent
```

The application must still:

* launch;
* create its window;
* navigate;
* preview text;
* preview images.

For Linux, the test machine must contain only the documented native WebView and system-library dependencies.

This is a release acceptance criterion.

---

# 73. Platform Packaging

A conventional platform-specific package may later be desirable.

For macOS, this may include:

* `.app` bundle;
* application icon;
* `Info.plist`;
* menu integration;
* Dock identity;
* notarization;
* distribution metadata.

For Linux, this may include:

* AppImage;
* tar archive;
* desktop entry;
* application icon;
* distribution-specific package formats.

These packaging formats are distinct from the architectural requirement of producing a single executable.

For version 1, the canonical artifacts are standalone executables.

Optional platform packaging may wrap those executables later without changing the application architecture.

---

# 74. Code Signing

Developer builds may initially be unsigned or ad-hoc signed.

Production distribution should support platform-appropriate signing:

* Apple code signing and notarization on macOS;
* optional package or binary signing on Linux.

Signing infrastructure is not part of the functional implementation, but the build architecture must not prevent it.

Do not modify an executable after it has been signed.

---

# 75. Visual Design

Use system-like neutral styling.

Primary requirements:

* compact;
* clean;
* low visual noise;
* border-based pane separation;
* subtle selection backgrounds;
* readable typography;
* responsive to system appearance;
* not dependent on macOS-only visual conventions.

Use:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

No custom font needs to be embedded.

---

# 76. Light Mode

Use neutral colors approximating lightweight desktop utility applications.

Example conceptual palette:

```text
window background: system neutral
sidebar background: slightly differentiated
separator: subtle gray
selection: system-accent-like translucent fill
primary text: high contrast
secondary text: subdued
```

Avoid hard-coding appearance where CSS system colors can provide adequate results.

---

# 77. Dark Mode

Use:

```css
@media (prefers-color-scheme: dark)
```

The application must remain fully legible when the operating system switches appearance while the application is open.

Do not require application restart.

On Linux, behaviour may depend on the desktop environment and WebView support. The application must still provide a coherent fallback theme when system appearance information is unavailable.

---

# 78. Accessibility

Minimum requirements:

* keyboard navigation;
* visible focus;
* semantic buttons;
* appropriate ARIA roles where native HTML semantics are insufficient;
* contrast suitable for normal accessibility requirements;
* no information conveyed exclusively through color.

Directory items should expose their names to assistive technology.

Icons that are purely decorative should be hidden from screen readers.

---

# 79. Status Bar

A small status bar may appear along the bottom.

Left:

```text
24 items
```

Right:

```text
/home/user/Documents
```

When an item is selected, right may display:

```text
/home/user/Documents/notes.txt
```

The status bar is informational only.

---

# 80. Refresh

The first release may include a Refresh command.

Keyboard shortcut:

```text
Command + R on macOS
Ctrl + R on Linux
```

Refresh performs:

```text
re-enumerate current directory
preserve selection if item still exists
otherwise clear selection
```

Refresh must not reload the whole WebView.

---

# 81. Automatic Filesystem Watching

Automatic filesystem watching is optional.

It is not necessary for the minimum version.

If implemented using `fs.watch`, events should trigger a debounced directory refresh.

Example debounce:

```text
150–300 ms
```

The application must not create one watcher for every directory displayed historically.

At most the current directory needs to be watched.

Filesystem watcher behaviour may differ between macOS and Linux. The application must tolerate duplicate, missing, or coalesced events.

---

# 82. Initial Startup

Startup flow:

```text
1. Start Bun executable.
2. Detect supported operating system.
3. Resolve home directory.
4. Determine sidebar locations.
5. Create native WebView.
6. Register RPC bindings.
7. Load embedded UI.
8. Show window.
9. Navigate to Home.
10. Enumerate Home.
11. Render directory.
```

Failure to resolve Home should fall back to:

```text
/
```

If the native WebView cannot be initialized, display a clear platform-specific startup error and exit cleanly.

---

# 83. Application Shutdown

Closing the window should terminate the application cleanly.

Shutdown must:

* release WebView resources;
* close filesystem watchers if any;
  -cancel irrelevant pending operations where feasible;
* exit with status `0` after normal closure.

No persistence operation occurs during shutdown.

---

# 84. Testing Strategy

Tests must focus on domain logic rather than trying to automate every WebView interaction.

Use:

```bash
bun test
```

Tests should run on both macOS and Linux where practical.

Platform-specific tests may be conditionally skipped only when they require unavailable operating-system features.

---

# 85. Filesystem Unit Tests

Create tests using temporary directories.

Test:

```text
directory enumeration
natural ordering
hidden file filtering
file metadata
directories
text detection
binary detection
symlinks
broken symlinks
permission errors where practical
missing files
large preview truncation
image size limits
path normalization
platform-specific location discovery
volume discovery fallback behaviour
```

Temporary test data must be deleted by the test harness.

Tests must not modify user-owned files.

---

# 86. Preview Tests

Test that:

```text
.txt      → text
.md       → text
.ts       → text
.png      → image
.jpg      → image
binary    → generic
directory → directory
```

Test maximum limits:

```text
text > 1 MiB → truncated
image > 25 MiB → no image payload
```

---

# 87. Security Tests

At minimum test filenames containing:

```text
<
>
"
'
&
<script>
newlines
Unicode
emoji
```

The UI must render these as filenames and never as executable markup.

Test HTML contents containing scripts.

They must appear as text.

Test JavaScript files containing executable code.

They must never execute.

---

# 88. RPC Tests

Invalid input:

```text
null
undefined
empty string
relative path
NUL-containing path
object instead of string
array instead of string
```

must result in controlled errors rather than backend exceptions escaping the RPC layer.

---

# 89. UI Tests

Minimum manual or automated UI checks:

```text
window resize
column resizing
light mode
dark mode
directory navigation
back
forward
parent
single selection
keyboard selection
image preview
text preview
unsupported file
permission error
deleted item
removed volume
hidden files toggle
macOS modifier shortcuts
Linux modifier shortcuts
```

---

# 90. Performance Targets

These are engineering targets rather than hard real-time guarantees.

## Application startup

Target:

```text
< 500 ms to visible window
```

on a contemporary machine under normal conditions, excluding first-time native WebView initialization overhead where applicable.

## Ordinary directory

For a directory containing fewer than 1,000 entries:

```text
target < 100 ms filesystem enumeration
```

excluding unusually slow external or network filesystems.

## Preview

Small text/image previews should generally become visible within:

```text
< 100 ms
```

for local SSD or NVMe files.

The interface must remain responsive for slower operations.

---

# 91. Memory Behaviour

The application must avoid retaining previous preview data.

When selection changes:

```text
old image data
old text content
old preview model
```

must become eligible for garbage collection.

Do not maintain an unbounded preview cache.

Version 1 requires no preview cache.

---

# 92. File Reading Rules

Filesystem reads for preview must obey:

```text
text:
  max 1 MiB

text detection:
  max 8 KiB initial sample

image:
  max 25 MiB

generic:
  metadata only
```

The application must never implicitly read the full contents of an unsupported file.

---

# 93. Dependency Policy

Keep external dependencies minimal.

Expected production dependency:

```text
webview-bun
```

Avoid adding dependencies for functionality already supplied adequately by:

```text
Bun
TypeScript
DOM
CSS
Node-compatible standard APIs
```

Examples of dependencies that should not be introduced without clear justification:

```text
lodash
axios
Express
React
Redux
Moment
Electron
Vite
Webpack
```

Bun already provides the relevant runtime and build facilities.

---

# 94. No Framework-Driven Architecture

Do not introduce:

```text
dependency injection container
repository pattern
service locator
event bus
CQRS
ORM
plugin system
microservices
local REST API
```

This is a local desktop utility.

Architecture should remain proportional to its problem.

---

# 95. Expected Repository Structure

Recommended:

```text
explorer/
│
├── package.json
├── bun.lock
├── tsconfig.json
├── README.md
│
├── scripts/
│   └── build.ts
│
├── src/
│   ├── shared/
│   │   └── contracts.ts
│   │
│   ├── host/
│   │   ├── main.ts
│   │   ├── filesystem.ts
│   │   ├── locations.ts
│   │   ├── preview.ts
│   │   ├── mime.ts
│   │   ├── rpc.ts
│   │   ├── platform.ts
│   │   └── errors.ts
│   │
│   └── ui/
│       ├── index.html
│       ├── main.ts
│       ├── app.ts
│       ├── state.ts
│       ├── rpc.ts
│       │
│       ├── components/
│       │   ├── navigation-pane.ts
│       │   ├── directory-pane.ts
│       │   ├── preview-pane.ts
│       │   ├── toolbar.ts
│       │   └── splitter.ts
│       │
│       └── styles/
│           ├── base.css
│           ├── layout.css
│           ├── navigation.css
│           ├── directory.css
│           └── preview.css
│
├── test/
│   ├── filesystem.test.ts
│   ├── preview.test.ts
│   ├── paths.test.ts
│   ├── locations.test.ts
│   └── security.test.ts
│
└── dist/
    ├── explorer-macos-arm64
    └── explorer-linux-x64
```

`dist/` is generated.

---

# 96. Required User Journey

## Journey: Browse and inspect a file

Given the application has started:

```text
1. User sees Home.
2. Home contents appear in the middle pane.
3. User selects Documents in the sidebar.
4. Documents contents appear.
5. User selects the Projects folder.
6. The right pane shows Projects folder details.
7. User double-clicks Projects.
8. Projects becomes the current directory.
9. User selects README.md.
10. The right pane displays README.md as text.
11. User selects screenshot.png.
12. The right pane displays screenshot.png as an image.
13. User presses Command + [ on macOS or Ctrl + [ on Linux.
14. The application returns to Documents.
```

At no point is any filesystem content modified.

---

# 97. Read-Only Invariant

The implementation must contain no application call to mutation APIs such as:

```text
writeFile
appendFile
truncate
unlink
rm
rmdir
mkdir
rename
copyFile
chmod
chown
symlink creation
hard-link creation
```

except inside test setup/teardown code.

A static code review should be able to confirm this.

---

# 98. Definition of Done

The first version is complete when all of the following hold:

* application is implemented in TypeScript;
* Bun is the application runtime;
* `webview-bun` provides the desktop window;
* the UI uses the native operating-system WebView on macOS and Linux;
* there is no Electron dependency;
* there is no Node runtime dependency;
* there is no local HTTP server;
* there is no frontend framework;
* there are three primary columns;
* sidebar navigation works;
* home-directory discovery works on macOS and Linux;
* common user-directory discovery works where directories exist;
* root navigation works;
* mounted-volume discovery works according to platform capabilities;
* directory listing works;
* Back works;
* Forward works;
* parent navigation works;
* keyboard item navigation works;
* hidden-file toggle works;
* platform-appropriate keyboard modifiers work;
* directory previews work;
* text previews work;
* image previews work;
* unsupported files display metadata;
* permission failures are handled;
* disappearing files are handled;
* unsupported content cannot execute code;
* filesystem operations are view-only;
* application creates no persistent state;
* UI assets are embedded;
* Bun runtime is embedded;
* Bun does not need to be installed on the target machine;
* application can run with networking disabled;
* production output consists of one executable per target platform and architecture;
* documented native WebView dependencies are sufficient for launching on supported Linux systems;
* tests pass using `bun test`.

---

# 99. Explicit Non-Goals

The following must not be implemented as part of version 1:

```text
Windows support
file creation
directory creation
rename
delete
move
copy
drag-and-drop filesystem operations
file editing
text editing
Save
Save As
search
Spotlight integration
tags
favorites editing
recent files
multi-selection
Quick Look integration
PDF rendering
video playback
audio playback
archive browsing
cloud providers
iCloud integration
SMB browsing
FTP
SFTP
Git integration
terminal integration
shell commands
plugins
extensions
tabs
multiple windows
database
application settings
telemetry
auto-update
```

These exclusions are intentional.

---

# 100. Architectural Summary

The complete application should remain conceptually this small:

```text
                 Explorer
                    │
        ┌───────────┴───────────┐
        │                       │
   Native WebView UI        Bun host
        │                       │
  TypeScript + CSS          TypeScript
        │                       │
        └──── narrow RPC ───────┤
                                │
                         read-only filesystem
                                │
                         macOS or Linux
```

Production packaging:

```text
HTML
CSS
UI TypeScript
Host TypeScript
webview-bun
Bun runtime
application assets
        │
        ▼
   Bun compilation
        │
        ▼
┌────────────────────────────┐
│ explorer-platform-arch     │
│                            │
│ single native executable   │
└────────────────────────────┘
```

The application should demonstrate that a small cross-platform desktop utility does not inherently require a large desktop framework.

The central engineering constraints are:

> **Bun is the runtime. TypeScript is the application language. The native operating-system WebView is the renderer. The filesystem interface is read-only by construction. macOS and Linux are supported. Windows is out of scope. The complete application is delivered as one executable per target platform and architecture.**

[1]: https://bun.com/docs/bundler/executables "Single-file executable | Bun Docs"
