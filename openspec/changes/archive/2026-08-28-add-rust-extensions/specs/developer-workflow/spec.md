## MODIFIED Requirements

### Requirement: Fast edit-run loop
The development command SHALL, by default, watch the selected application's source — including the source of any native extension it declares — and the template's source, rebuild what changed, and restart the running application, reporting each rebuild. A developer SHALL be able to disable watching for a single run. A native rebuild SHALL NOT be triggered by changes that cannot affect it, and a failed native rebuild MUST NOT leave a stale artifact, or an artifact built for another target, loaded.

#### Scenario: Edit the user interface while running
- **WHEN** a developer changes a source file of the running application
- **THEN** the artifact is rebuilt, the application restarts with the change visible, and the terminal reports the rebuild

#### Scenario: Edit native extension source while running
- **WHEN** a developer changes the source of a declared native extension
- **THEN** that extension is rebuilt, the host process restarts with the new artifact loaded, and the loaded native code is never replaced inside a running process

#### Scenario: Edit only the user interface of an application with an extension
- **WHEN** a developer changes only user-interface source in an application that declares a native extension
- **THEN** the native extension is not rebuilt and the fastest available development path is used

#### Scenario: A rebuild fails
- **WHEN** a change introduces an error that prevents the artifact from building
- **THEN** the error is reported, the watcher keeps running, and a subsequent corrected change rebuilds successfully without restarting the command

#### Scenario: A native rebuild fails
- **WHEN** a native rebuild fails after its source changed
- **THEN** the failure is reported, the previously built artifact is not loaded as though it were current, and the application does not start with the capability silently missing

#### Scenario: Disable watching
- **WHEN** a developer starts the development command with watching disabled
- **THEN** the application builds and runs once and no watcher is established
