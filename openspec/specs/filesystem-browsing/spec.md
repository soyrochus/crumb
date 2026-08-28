# filesystem-browsing Specification

## Purpose
A `file-explorer` example requirement. View-only discovery of filesystem locations, bounded directory listing, and transactional navigation — domain behavior that an application built on Crumb for a different purpose replaces entirely.

## Requirements

### Requirement: Read-only filesystem implementation
The `file-explorer` example application SHALL be view-only, a constraint it adopts to keep its own implementation simple and auditable rather than one the template imposes. All of its production filesystem access SHALL be owned by the Bun host and SHALL use inspection and bounded-read APIs only. Its production code MUST NOT call filesystem creation, writing, copying, moving, renaming, deletion, permission, ownership, or link-creation APIs and MUST NOT invoke a shell. The static check that enforces this SHALL cover the example application's source and SHALL NOT be applied to template-owned source or to other applications built on the template.

#### Scenario: Static read-only review
- **WHEN** the example application's production source is searched for mutation and shell-execution APIs
- **THEN** no application call to such an API exists outside test setup and teardown code

#### Scenario: Build a writing application on the template
- **WHEN** a different application built on the template calls filesystem writing APIs
- **THEN** the example's read-only check does not apply to it and does not fail its build

### Requirement: Platform-aware locations
The application SHALL expose Home when resolvable, existing common user directories, root, and reliably discovered mounted locations without creating missing directories. Home resolution SHALL use a runtime or operating-system API with root as fallback; Linux common directories SHALL honor valid XDG configuration.

#### Scenario: Resolve existing user locations
- **WHEN** Home and some candidate user directories exist
- **THEN** Home and each existing candidate are returned once with stable labels and normalized absolute paths while missing candidates are omitted

#### Scenario: Fall back when Home is unavailable
- **WHEN** the user's home directory cannot be resolved or validated
- **THEN** root is available as the initial and sidebar location

#### Scenario: Discover baseline volumes
- **WHEN** locations are requested on macOS or Linux
- **THEN** root is present and accessible platform-conventional mount directories are included without presenting known pseudo-filesystems as user volumes

### Requirement: Bounded directory listing
The host SHALL asynchronously enumerate only immediate children, apply hidden-file filtering during enumeration, and return no more than 50,000 entries. It SHALL set `truncated` when additional eligible entries exist and SHALL NOT recursively traverse children.

#### Scenario: List an ordinary directory
- **WHEN** the UI requests an accessible directory containing no more than 50,000 eligible direct children
- **THEN** the host returns all eligible direct children with `truncated` set to false and performs no recursive scan

#### Scenario: List a pathological directory
- **WHEN** more than 50,000 eligible direct children are observed
- **THEN** enumeration stops after detecting overflow, at most 50,000 entries are returned, and `truncated` is true

### Requirement: Directory entry metadata
Each listed entry SHALL include name, normalized absolute path, kind, extension, available size and timestamps, hidden/readable indicators, and explicit symlink information. Missing or unsupported metadata SHALL be represented as null rather than fabricated.

#### Scenario: Entry disappears during enumeration
- **WHEN** an entry disappears after being observed but before metadata inspection completes
- **THEN** the listing completes with a recoverable outcome and the application does not terminate

### Requirement: Natural deterministic ordering
Listings SHALL order directories before files, files before other entries, and sort names within each group using locale-aware, case-insensitive natural ordering.

#### Scenario: Sort numbered names
- **WHEN** one category contains `file10`, `file2`, and `file1`
- **THEN** the returned order is `file1`, `file2`, `file10`

### Requirement: Hidden-file visibility
Names beginning with a dot SHALL be hidden by default. The current process SHALL allow visibility to be toggled and SHALL retain that choice only for the process lifetime.

#### Scenario: Toggle hidden entries
- **WHEN** the user toggles hidden-file visibility in a directory containing `.secret`
- **THEN** the current directory is re-enumerated and `.secret` is included or excluded according to the new in-memory setting

### Requirement: Transactional directory navigation
Successful navigation SHALL update the current directory, clear item selection, and update Back/Forward history according to the navigation action. A failed navigation MUST NOT commit a new current directory or corrupt history.

#### Scenario: Navigate into a directory
- **WHEN** the user enters an accessible selected directory
- **THEN** that normalized lexical path becomes current, selection is cleared, the previous path enters Back history, and Forward history is cleared

#### Scenario: Navigate back and forward
- **WHEN** the user navigates Back and then Forward through successfully visited directories
- **THEN** each successful operation restores the corresponding directory and maintains the opposite history stack

#### Scenario: Navigation fails
- **WHEN** a target disappears or becomes inaccessible before its listing succeeds
- **THEN** the previous directory and history remain current and a recoverable error is shown

### Requirement: Parent navigation
The application SHALL derive parent paths using standard path APIs and SHALL never navigate above root.

#### Scenario: Request parent at root
- **WHEN** root is current and parent navigation is requested
- **THEN** root remains current and no invalid history entry is created

### Requirement: Explicit symlink behavior
Symlink entries SHALL preserve their own kind plus target kind and broken status when available. A symlink to a directory MAY be entered using its normalized lexical path; broken or inaccessible links SHALL remain nonfatal.

#### Scenario: Enter a directory symlink
- **WHEN** the user enters a readable symlink whose target is a directory
- **THEN** the link's normalized lexical path becomes current and its direct target contents are listed without recursive traversal

#### Scenario: Select a broken symlink
- **WHEN** a listed symlink has no accessible target
- **THEN** it is represented as broken and selection or preview produces a recoverable unavailable result

### Requirement: Latest directory request wins
The UI SHALL associate each directory request with a monotonically increasing identifier and requested path, and SHALL apply a response only while both still match the active navigation.

#### Scenario: Older listing finishes last
- **WHEN** navigation to B supersedes navigation to A but A's listing completes after B's listing
- **THEN** the UI keeps B as current and discards A's stale response

### Requirement: Recoverable external changes
Not-found, permission-denied, wrong-kind, and unavailable-volume failures SHALL be normalized and displayed without retry loops, privilege escalation, permission changes, or application termination.

#### Scenario: Current volume is removed
- **WHEN** the current external volume disappears and the user refreshes or navigates
- **THEN** the application shows an unavailable-location error and remains able to navigate to another sidebar location
