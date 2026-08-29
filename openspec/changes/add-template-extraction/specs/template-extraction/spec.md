## ADDED Requirements

### Requirement: Extract command
The template SHALL provide a command, run from a Crumb clone, that stages every
template-owned file required to build and run a Crumb application into an
external target directory. The command SHALL accept the target directory as a
required argument, SHALL support a preview mode that writes nothing, and SHALL
fail with a non-zero exit status and a diagnostic message on any error rather
than partially completing silently.

#### Scenario: Stage into a target directory
- **WHEN** a developer runs the extract command from a Crumb clone naming an existing external directory as the target
- **THEN** a `crumb-source/` directory is created inside the target containing the template-owned file set, and the command reports each staged path and the remaining manual steps

#### Scenario: Preview without writing
- **WHEN** a developer runs the extract command in preview mode
- **THEN** the command prints the complete plan of what it would stage and what manual steps would remain, and creates and modifies nothing

#### Scenario: Target directory does not exist
- **WHEN** the extract command is given a target that is not an existing directory
- **THEN** it fails immediately with a message naming the problem and stages nothing

### Requirement: Staged set is the template machinery only
The staged file set SHALL contain the reusable kit, the development and build
pipeline scripts, the native binding patch, the release entry point, the strict
TypeScript configuration, and the template's own tests. It MUST NOT contain the
starter application, any worked example, application-owned source, or the
project's prose documentation and artwork. The set SHALL be defined by an
explicit allowlist, and the command SHALL fail if any allowlisted path is
absent from the clone.

#### Scenario: Inspect what was staged
- **WHEN** a developer examines the `crumb-source/` directory after a successful run
- **THEN** it contains the kit, the pipeline scripts, the native patch, the release entry point, and the TypeScript configuration, and it contains no starter application, example application, or `README`

#### Scenario: Example-only scripts are excluded
- **WHEN** the staged pipeline is examined
- **THEN** scripts that exist only to verify a worked example are not present, and no staged script imports from an example

#### Scenario: The template has been refactored and an allowlisted path is gone
- **WHEN** the extract command runs against a clone in which an allowlisted path no longer exists
- **THEN** it fails with a message identifying the missing path and stages nothing

### Requirement: No modification of the clone or of existing target files
The extract command SHALL NOT write anywhere outside the `crumb-source/`
directory within the target, and SHALL NOT write anywhere inside the Crumb clone
it runs from. It SHALL refuse to run when the target resolves to a location
inside the Crumb clone. An existing non-empty `crumb-source/` in the target
SHALL stop the command unless the developer explicitly opts in to overwriting,
and even then only paths the command itself stages SHALL be replaced.

#### Scenario: Existing target files are untouched
- **WHEN** the extract command stages into a target that already contains its own `package.json`, `tsconfig.json`, `scripts/`, and source tree
- **THEN** none of those existing files or directories are modified, and all staged content is confined to `crumb-source/`

#### Scenario: The clone is never written to
- **WHEN** the extract command completes, whether successfully or with an error
- **THEN** the Crumb clone it ran from has no created, modified, or deleted files

#### Scenario: Target is inside the clone
- **WHEN** the extract command is given a target directory that is the Crumb clone or a subdirectory of it
- **THEN** it refuses to run and stages nothing

#### Scenario: Staging directory already exists
- **WHEN** the target already contains a non-empty `crumb-source/` directory and the developer has not opted in to overwriting
- **THEN** the command fails with a message explaining how to proceed and stages nothing

### Requirement: Merge-required content is delivered as fragments and instructions
The command SHALL deliver content that a target project must combine with its
own equivalents — dependency manifest entries, ignore rules, and the application
registry — as separate fragment files together with ordered written
instructions. The command MUST NOT deliver that content as drop-in replacements
for the target's existing files. The instructions SHALL record which Crumb
version the staged set was taken from.

#### Scenario: Read the merge instructions
- **WHEN** a developer opens the instructions file in `crumb-source/` after a run
- **THEN** it lists, in order, the steps to apply the staged files, merge the manifest and ignore fragments, place a trimmed application registry, and add their own interface under `src/app/`, and it names the Crumb version the staged set came from

#### Scenario: Manifest fragment is not a whole file
- **WHEN** a developer examines the dependency manifest fragment
- **THEN** it contains only the keys Crumb requires the target to add, in a form the developer merges into their existing manifest, not a complete replacement manifest

### Requirement: An assistant skill applies the extracted files into a project
The template SHALL ship an assistant skill, in the canonical skill source and
therefore in every supported assistant's installed copies, that carries the
project-specific work of turning an extracted `crumb-source/` into a running
Crumb application inside an existing project. The skill SHALL cover merging the
staged files into their positions, reconciling the dependency manifest and the
TypeScript configuration, mapping an existing web interface into `src/app/`,
adjusting a framework build to a single server-less bundle entry, creating the
application registry, and reaching a working development run. The skill SHALL
defer to `MERGE.md` and the how-to guide for the ceremony and MUST NOT restate
what it can reference, consistent with skills being subordinate to the
documentation.

#### Scenario: Apply an extracted staging directory with an assistant
- **WHEN** a developer has run the extract command and asks an assistant to adopt Crumb into the existing project
- **THEN** the assistant follows the skill to merge `crumb-source/` into the project, reconcile the manifest and TypeScript configuration, place the existing interface under `src/app/`, create the registry, and start the development run

#### Scenario: Skill is installed for every supported assistant
- **WHEN** the skill installation command runs
- **THEN** the adopt-existing-project skill is installed into every supported assistant's location alongside the other shipped skills, and `--check` verifies its committed copies

#### Scenario: Skill and documentation disagree
- **WHEN** the skill's guidance conflicts with `MERGE.md` or the how-to guide
- **THEN** the documentation governs and the skill is corrected

### Requirement: Extraction is documented alongside the clone workflow
The project documentation SHALL describe the extraction path for bringing Crumb
into an existing external project, next to the existing clone-based quick start,
so a developer with a pre-existing web application repository can find it. The
documentation SHALL name both the `extract` command and the assistant skill that
applies its output.

#### Scenario: Look for how to add Crumb to an existing project
- **WHEN** a developer who already has a web application reads the README or the how-to guide
- **THEN** the extract command and its manual follow-up steps are documented as the supported way to adopt Crumb without moving their project into a clone, and the assistant skill is named as the way to have an agent perform the follow-up
