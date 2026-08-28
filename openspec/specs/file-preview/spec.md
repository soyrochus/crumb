# file-preview Specification

## Purpose
A `file-explorer` example requirement. Bounded, inert previews of directories, text, and images, in which file content is treated as untrusted data and is never interpreted, executed, or read in full.

## Requirements

### Requirement: Discriminated preview contract
`getPreview` SHALL return exactly one directory, image, text, or generic preview variant selected by an explicit discriminator, and each variant SHALL include complete available item details.

#### Scenario: Render by discriminator
- **WHEN** a valid preview response reaches the UI
- **THEN** the UI selects its renderer solely from the response discriminator rather than inferring type from optional fields

### Requirement: Directory preview
A directory preview SHALL show folder identity, available metadata, and a bounded count of direct children, and MUST NOT recursively calculate total size.

#### Scenario: Preview a directory
- **WHEN** an accessible directory is selected
- **THEN** its name, kind, available timestamps, path, and direct-child count are displayed without recursive traversal

### Requirement: Safe bounded text preview
Known text extensions and unknown regular files whose at-most-8-KiB sample is valid text without significant binary controls SHALL receive a plain-text preview. The host SHALL read at most 1 MiB, decode UTF-8 with replacement for malformed sequences, and report truncation and total size.

#### Scenario: Preview a small text file
- **WHEN** a supported text file is no larger than 1 MiB
- **THEN** its decoded content and metadata are returned with `truncated` false

#### Scenario: Preview a large text file
- **WHEN** a supported text file exceeds 1 MiB
- **THEN** only its first 1 MiB is read and returned with `truncated` true, bytes read, and total bytes

#### Scenario: Detect an unknown binary file
- **WHEN** an unknown extension has significant binary controls in its initial sample
- **THEN** it receives a generic preview without reading the complete file

### Requirement: Safe bounded image preview
PNG, JPEG, GIF, and WebP regular files no larger than 25 MiB SHALL be read by the host and returned through a MIME-validated base64 data URL. Larger images SHALL return metadata and a too-large indicator without reading their full contents.

#### Scenario: Preview a supported image
- **WHEN** a supported image is no larger than 25 MiB
- **THEN** it is displayed through an image element with preserved aspect ratio and size constrained to the preview area

#### Scenario: Reject an oversized image payload
- **WHEN** a supported image exceeds 25 MiB
- **THEN** no image bytes or data URL are returned and the UI explains that inline preview is unavailable

### Requirement: SVG receives no active preview
SVG SHALL receive a generic metadata preview in the initial release and SHALL NOT be inserted as markup, script, document content, or an active image resource.

#### Scenario: Select a scripted SVG
- **WHEN** an SVG containing script or event handlers is selected
- **THEN** metadata is displayed and none of the SVG content is loaded into an executable document context

### Requirement: Untrusted text remains inert
Text, HTML, Markdown, JavaScript, filenames, paths, and metadata SHALL be rendered with safe text operations. File content MUST NOT be assigned to `innerHTML`, evaluated, imported, or loaded as a script.

#### Scenario: Preview malicious HTML
- **WHEN** an HTML file contains a script element and event-handler attributes
- **THEN** its source is displayed as literal text and no contained code executes

#### Scenario: Display a hostile filename
- **WHEN** a filename contains markup characters, newlines, Unicode, emoji, or a script-like string
- **THEN** its literal name is exposed to the user and assistive technology without changing document structure or executing code

### Requirement: Generic metadata preview
Unsupported files, files rejected by safe classification, and supported rich formats outside the initial scope SHALL display available Name, Kind, Extension, Size, Created, Modified, Path, and optional symlink information without content interpretation.

#### Scenario: Preview an unsupported binary
- **WHEN** an unsupported readable regular file is selected
- **THEN** its available metadata is displayed and its content is not read beyond any bounded classification sample

### Requirement: Latest preview request wins
The UI SHALL associate each preview request with a monotonically increasing identifier and selected path, discard superseded responses, and release references to prior preview payloads.

#### Scenario: Older preview finishes last
- **WHEN** selection B supersedes selection A but A's preview finishes after B's preview
- **THEN** the UI continues to display B and does not retain or apply A's payload

### Requirement: Locale-aware metadata presentation
File sizes SHALL use base-1024 IEC units and timestamps SHALL be serialized as ISO 8601 by the host and displayed using the user's locale. Unavailable fields SHALL be omitted or shown with a neutral placeholder.

#### Scenario: Display size and date
- **WHEN** a preview contains a 1,048,576-byte file and a valid modification timestamp
- **THEN** the UI displays `1 MiB` and formats the timestamp using the current operating-system locale
