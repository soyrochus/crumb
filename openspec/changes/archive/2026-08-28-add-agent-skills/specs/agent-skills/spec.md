## ADDED Requirements

### Requirement: Canonical vendor-neutral skill source
The template SHALL keep the skills it ships in one canonical location that names no coding assistant, and every installed copy SHALL be derived from it. A skill SHALL be expressed in a single format that every supported assistant reads unmodified, so that the source itself contains no per-vendor variant, conditional, or branding. The canonical source SHALL be template-owned material rather than the property of one application built on the template.

#### Scenario: Read the canonical source
- **WHEN** the shipped skills are inspected at their canonical location
- **THEN** each skill is a self-contained unit of guidance whose content names no assistant, vendor, or vendor-specific directory

#### Scenario: Add a skill
- **WHEN** a new skill is added to the canonical location
- **THEN** it becomes installable to every supported assistant with no per-assistant authoring, and no vendor-specific file is written by hand

### Requirement: One-command installation for every supported assistant
Installing the shipped skills SHALL be a single documented command that places them where each supported assistant discovers them, without the developer copying files, learning a per-assistant layout, or running one command per assistant. A developer SHALL be able to install for one named assistant instead of all of them, and SHALL be able to list what would be installed without writing anything.

#### Scenario: Install for every assistant
- **WHEN** a developer runs the installation command without naming an assistant
- **THEN** every skill in the canonical source is installed into the location each supported assistant reads, and the command reports what it wrote

#### Scenario: Install for one assistant
- **WHEN** a developer runs the installation command naming a single supported assistant
- **THEN** only that assistant's location is written, and the others are left exactly as they were

#### Scenario: Name an assistant that is not supported
- **WHEN** the installation command names an assistant the template does not support
- **THEN** it fails immediately, lists the supported assistants, and writes nothing

### Requirement: Installation is additive and bounded to what the template owns
Installation SHALL only create or replace the skills present in the canonical source. It MUST NOT delete, rewrite, or reorganize any other content in an assistant's directory, including skills installed there by an unrelated tool or written by the developer. An assistant directory that the template has never written to SHALL be created rather than treated as an error.

#### Scenario: Install beside skills owned by another tool
- **WHEN** an assistant's directory already contains skills the template does not own
- **THEN** installation leaves them byte-for-byte unchanged and writes only the skills the canonical source contains

#### Scenario: Reinstall after editing an installed copy
- **WHEN** an installed copy has been edited and installation runs again
- **THEN** the copy is restored to match its canonical source, and the command reports that it replaced it

### Requirement: Installed copies are verifiable against their source
Because installed copies are committed to the repository, the template SHALL provide a check that reports any installed copy that is missing, or that differs from its canonical source, and that fails rather than repairing what it finds. The check SHALL succeed only when every skill in the canonical source is present and identical in every supported assistant's location.

#### Scenario: Verify copies that are in sync
- **WHEN** the check runs and every installed copy matches its canonical source
- **THEN** it reports success, exits with a success status, and modifies nothing

#### Scenario: Verify after the canonical source changes
- **WHEN** a skill is edited at its canonical location and the check runs before installation
- **THEN** it fails, exits with a failure status, identifies each stale or missing copy, and leaves every file unchanged

### Requirement: Skills cover the boundaries a mistake would breach
The shipped skills SHALL cover the template's multi-file ceremonies and its declared invariants — those where a partially correct result builds, runs, and is wrong. For each, a skill SHALL state every part that must change together and the reason the most skippable part is not optional. A skill covering a capability boundary SHALL state what the boundary is and what the template's automated checks do not cover.

#### Scenario: Follow a skill for a multi-file ceremony
- **WHEN** an assistant follows a skill for a task that requires several files to agree
- **THEN** the skill names every file the task must change, and omitting any one of them is identified as incorrect rather than incomplete

#### Scenario: Follow a skill that touches a security boundary
- **WHEN** a skill covers work crossing the boundary between untrusted page content and trusted host code
- **THEN** it states that the runtime check is a security boundary rather than a type-level convenience, and does not present it as optional

### Requirement: Skills are subordinate to the documentation and specifications
A skill SHALL be a shortcut to the documented workflow, never a competing description of it. A skill MUST NOT restate material it can reference, MUST NOT contradict the documentation or the specifications, and SHALL point to the authoritative document for anything beyond the ceremony and invariants it exists to enforce. Where a skill and a specification disagree, the specification SHALL govern.

#### Scenario: Encounter a disagreement
- **WHEN** a skill's guidance conflicts with a specification or the documentation
- **THEN** the specification governs and the skill is corrected, rather than the two being left to describe the template differently

#### Scenario: Look for detail a skill does not carry
- **WHEN** a task needs detail beyond the ceremony a skill encodes
- **THEN** the skill directs the reader to the authoritative document rather than reproducing it

### Requirement: Skills do not affect what the template produces
Shipping and installing skills SHALL have no effect on the host, the bridge, the build pipeline, or any produced executable. Skills SHALL NOT be embedded in a release artifact, and an application SHALL build, run, and release identically whether or not any skill has been installed.

#### Scenario: Build with and without installed skills
- **WHEN** an application is built before and after skills are installed
- **THEN** the resulting executable is unaffected, and no skill content appears in it

#### Scenario: Use the template without an assistant
- **WHEN** a developer uses the template without installing any skill
- **THEN** every documented development and release workflow remains complete and unchanged
