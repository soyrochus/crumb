## Purpose

An `activity-monitor` example requirement. A read-only system inspector — overall load, memory, and a live process list — whose collection is implemented as a Rust native extension while its interface stays an ordinary Crumb web application. It is the worked example for native extensions, the sibling of `file-explorer`, and like it is an example application rather than anything the template promises.

## ADDED Requirements

### Requirement: System summary
The application SHALL present overall processor utilisation, total and used memory, and a count of running processes. Each value SHALL be labelled with its unit, and a value the running platform cannot supply SHALL be shown as unavailable rather than as zero or an invented figure.

#### Scenario: Display a system summary
- **WHEN** the application collects a system snapshot on a supported platform
- **THEN** processor utilisation, total and used memory, and the process count are displayed with their units

#### Scenario: A platform cannot supply a metric
- **WHEN** a metric such as load average is unavailable on the running platform
- **THEN** it is shown as unavailable, and no substitute or zero value is presented as though it were measured

### Requirement: Process list
The application SHALL list running processes with at least identifier, name, processor usage, memory usage, and state. The list SHALL be sortable by column and SHALL indicate which column currently orders it. Processes SHALL be presented as untrusted text: a process name MUST NOT be interpreted as markup or executed.

#### Scenario: List processes
- **WHEN** a process list is collected
- **THEN** each row shows identifier, name, processor usage, memory usage, and state

#### Scenario: Sort by a column
- **WHEN** the user sorts by processor or memory usage
- **THEN** the list reorders accordingly and the active sort column and direction are indicated

#### Scenario: Display a hostile process name
- **WHEN** a process name contains markup characters, control characters, or a script-like string
- **THEN** the literal name is displayed as text and nothing in it is interpreted as markup or executed

### Requirement: Bounded refresh
The application SHALL refresh its data on explicit request and MAY refresh on a bounded interval. A refresh MUST NOT be started while one is outstanding, and a superseded result MUST NOT replace newer data. Sampling MUST NOT block the window.

#### Scenario: Refresh on request
- **WHEN** the user requests a refresh
- **THEN** the summary and process list update, and the interface stays responsive while collection runs

#### Scenario: Refresh while one is outstanding
- **WHEN** a refresh is requested while one is already running
- **THEN** no second collection is started, and the outstanding one completes normally

#### Scenario: An earlier sample finishes last
- **WHEN** an earlier collection completes after a later one
- **THEN** the later data remains displayed and the superseded result is discarded

### Requirement: Collection happens in a native extension
System and process data SHALL be collected by a native extension declared by this application, not by the host's own language. The extension SHALL be reachable only through the application's declared and validated operations, and its results SHALL be normalized into the application's serializable contract before crossing to the page.

#### Scenario: Collect through the declared boundary
- **WHEN** the page requests a system snapshot or process list
- **THEN** the request goes through a declared, validated operation whose handler calls the native extension, and the page receives a normalized serializable result

#### Scenario: Native collection fails
- **WHEN** the extension cannot collect a value — permission denied, an unsupported platform feature, or a process disappearing mid-inspection
- **THEN** the failure is reported as a recoverable application error, the application keeps running, and the remaining data is still presented

### Requirement: Inspection only
The application SHALL NOT terminate, suspend, reprioritise, or otherwise act on any process, and SHALL NOT expose an operation capable of doing so. Its declared operations SHALL be limited to reading system and process information.

#### Scenario: Review the declared operations
- **WHEN** the application's declared operations are enumerated
- **THEN** every one of them reads information, and none acts on a process

#### Scenario: Select a process
- **WHEN** the user selects a process row
- **THEN** further detail about that process may be shown, and no control capable of acting on it is offered

### Requirement: Runs from a relocated executable
The application SHALL work as a standalone executable with its native extension embedded. Copying only the executable to an otherwise empty directory SHALL be sufficient to collect and display real system information, with no adjacent native artifact and no Rust toolchain present.

#### Scenario: Exercise the relocated executable
- **WHEN** only the built executable is copied to an empty directory on a supported machine and launched
- **THEN** it opens, collects a real system snapshot and a real process list, and displays them
