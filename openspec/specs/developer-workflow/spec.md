# developer-workflow Specification

## Purpose
Template promise. What Crumb guarantees about building an application *on* the template rather than shipping one from it: a minimal starting point, a fast edit-run loop, diagnostics that cannot reach a release artifact, more than one selectable application in one repository, and automated verification of the supported targets.

## Requirements

### Requirement: Minimal starting point
A new clone SHALL run a minimal application that demonstrates the template's capabilities and nothing more: one window, at least one declared operation, and a user interface small enough to read in full before editing it. The repository MUST NOT require a developer to delete or replace a substantial example application before beginning their own.

#### Scenario: Run a fresh clone
- **WHEN** a developer clones the repository, installs dependencies, and starts the development command without arguments
- **THEN** a window opens running the minimal application, and its complete source is small enough to read in one sitting

#### Scenario: Begin a new application
- **WHEN** a developer edits the minimal application's user interface and declares an additional operation
- **THEN** no example application's code is involved, and no template-owned file requires modification

### Requirement: Selectable application
The repository SHALL support more than one application, and the development and build commands SHALL target the application named in configuration or selected on the command line. A selectable application SHALL be a first-class build target rather than source a developer copies into place.

#### Scenario: Run an example by name
- **WHEN** a developer starts the development command naming an available example application
- **THEN** that application is built and launched with its own window title, dimensions, document policy, and declared operations

#### Scenario: Build an example by name
- **WHEN** a release build names an available example application
- **THEN** the resulting executable contains that application, and its output filename reflects the selected application rather than a fixed name

#### Scenario: Name an application that does not exist
- **WHEN** a command names an application the repository does not contain
- **THEN** it fails immediately with a message listing the available applications and builds nothing

### Requirement: Fast edit-run loop
The development command SHALL, by default, watch the selected application's and the template's source, rebuild the embedded user-interface artifact, and restart the running application when a file changes, reporting each rebuild. A developer SHALL be able to disable watching for a single run.

#### Scenario: Edit the user interface while running
- **WHEN** a developer changes a source file of the running application
- **THEN** the artifact is rebuilt, the application restarts with the change visible, and the terminal reports the rebuild

#### Scenario: A rebuild fails
- **WHEN** a change introduces an error that prevents the artifact from building
- **THEN** the error is reported, the watcher keeps running, and a subsequent corrected change rebuilds successfully without restarting the command

#### Scenario: Disable watching
- **WHEN** a developer starts the development command with watching disabled
- **THEN** the application builds and runs once and no watcher is established

### Requirement: Development-only diagnostics
The template SHALL enable WebView developer tools when running under the development command and SHALL disable them for any release build, regardless of application configuration. A release artifact MUST NOT ship an inspectable WebView.

#### Scenario: Inspect during development
- **WHEN** an application is running under the development command
- **THEN** the WebView's developer tools are available for inspecting the embedded document

#### Scenario: Build a release
- **WHEN** a release executable is produced
- **THEN** developer tools are disabled in it, and no application configuration value can enable them

### Requirement: Automated release verification
The repository SHALL verify every released version automatically on each supported target platform, covering the test suite, strict type checking, the example application's capability boundary, and a successful build of every application it ships. Verification SHALL be triggered by publishing a version tag rather than by each proposed change, because a run compiles platform-native components from source and is too costly to spend on every push. The documented local commands SHALL remain the per-change check. A status claim published in project documentation SHALL correspond to the most recent verification run.

#### Scenario: Publish a release
- **WHEN** a version tag is published
- **THEN** the test suite, strict type checking, the capability-boundary check, and a build of every shipped application run automatically on macOS arm64 and Linux x64

#### Scenario: Push a change without releasing
- **WHEN** a change is pushed or proposed but no version is tagged
- **THEN** no automated verification is triggered, and the repository documents the local commands that serve as the per-change check

#### Scenario: A release fails on one supported target
- **WHEN** a released version passes on one supported target and fails on another
- **THEN** the failure is reported and the release is not presented as verified
