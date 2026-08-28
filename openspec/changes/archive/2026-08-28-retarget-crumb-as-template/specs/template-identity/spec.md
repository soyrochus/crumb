## Purpose

Establishes what Crumb is — the template, toolchain, and documentation for shipping a server-less web application as a desktop application — and the boundary between what Crumb guarantees and what an example application merely demonstrates.

## ADDED Requirements

### Requirement: Declared project purpose
The project SHALL be documented as a template, toolchain, and documentation set for building a web application that runs without a server and delivering it as a desktop application: one native window, one self-contained executable, no bundled Chromium, no local HTTP server, and no runtime installation on the user's machine. Documentation MUST NOT present the project as a file explorer, a file manager, or any other end-user product.

#### Scenario: Read the project entry points
- **WHEN** a reader opens `README.md` or the living specification under `openspec/specs/`
- **THEN** the first description of the project states the template, toolchain, and documentation purpose, and the three-pane browser is identified as an example application rather than as the project

#### Scenario: Encounter a superseded document
- **WHEN** a reader opens a retained historical specification that describes the project as a file explorer
- **THEN** that document carries a prominent notice naming what superseded it, stating that it describes the example application, and pointing to the living specification

#### Scenario: Evaluate the project as a product
- **WHEN** a reader looks for the project's promised end-user features
- **THEN** the documentation offers a template and a build pipeline rather than a feature list, and directs feature questions to the example application

### Requirement: Template and application ownership boundary
Every source, script, and specification artifact SHALL be classifiable as template-owned or application-owned. Template-owned artifacts SHALL be free of application domain concepts and MUST NOT depend on any particular application's types, methods, or user interface. Application-owned artifacts SHALL be replaceable without altering template-owned artifacts.

#### Scenario: Classify an artifact
- **WHEN** any file in the repository is reviewed against the boundary
- **THEN** it is unambiguously template-owned or application-owned, and the documentation states which

#### Scenario: Replace the example application
- **WHEN** the example application is removed and a different application is supplied in its place
- **THEN** no template-owned artifact requires modification for the project to build and run

### Requirement: Template requirements exclude example behavior
A capability documented as a template promise MUST NOT contain requirements, method lists, window titles, dimensions, or acceptance journeys that describe one example application's behavior. Constraints an example adopts for its own reasons — including a read-only filesystem policy — SHALL be recorded in that example's capabilities, not in template capabilities.

#### Scenario: Review a template capability
- **WHEN** a template capability's requirements are read in isolation, without knowledge of any example application
- **THEN** every requirement remains meaningful and none names an example's domain operations or user interface

#### Scenario: Adopt a constraint for one application
- **WHEN** an example application restricts itself further than the template requires
- **THEN** that restriction appears only in the example's capabilities and is not presented as a guarantee the template makes

### Requirement: Project and example naming
The project SHALL be named Crumb. The three-pane browser SHALL be named `file-explorer` and identified as an example application. Identifiers that the template exposes to application code — including build-time virtual module specifiers and configuration keys — MUST NOT be branded with the project name, so that an application built on Crumb carries no Crumb branding in its own source.

#### Scenario: Name the project and its example
- **WHEN** documentation, specifications, or directory names refer to the project or to the three-pane browser
- **THEN** the project is called Crumb and the browser is called `file-explorer`

#### Scenario: Build an unrelated application on the template
- **WHEN** a developer writes an application that has no relationship to Crumb's example
- **THEN** the identifiers that application must reference are neutral, and the string `crumb` appears nowhere its own source is required to use
