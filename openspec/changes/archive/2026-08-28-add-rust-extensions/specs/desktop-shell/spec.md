## MODIFIED Requirements

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
