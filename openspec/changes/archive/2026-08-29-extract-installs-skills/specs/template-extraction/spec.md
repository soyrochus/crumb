## MODIFIED Requirements

### Requirement: No modification of the clone or of existing target files
The extract command SHALL NOT write anywhere inside the Crumb clone it runs
from, and SHALL refuse to run when the target resolves to a location inside the
Crumb clone. Within the target it SHALL write only into the `crumb-source/`
directory, with one exception: it SHALL install the Crumb `crumb-` assistant
skills into the target's assistant skill directories, additively — creating or
replacing only the template's own skills and never modifying or removing any
other file, including a skill another tool installed. An existing non-empty
`crumb-source/` in the target SHALL stop the command unless the developer
explicitly opts in to overwriting, and even then only paths the command itself
stages SHALL be replaced.

#### Scenario: Existing target files are untouched
- **WHEN** the extract command stages into a target that already contains its own `package.json`, `tsconfig.json`, `scripts/`, and source tree
- **THEN** none of those existing files or directories are modified, and the only writes outside `crumb-source/` are the added `crumb-` skill directories

#### Scenario: A non-Crumb skill in the target is left alone
- **WHEN** the target's assistant skill directory already contains a skill the template does not own
- **THEN** the extract installs the Crumb skills beside it and leaves it byte-for-byte unchanged

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
for the target's existing files. The dependency manifest fragment SHALL include
every Crumb script that functions in a target without the worked examples,
including the skill installation command. The instructions SHALL record which
Crumb version the staged set was taken from, SHALL present adopting Crumb with an
assistant as the primary path — noting that the extract has already installed the
skill — and SHALL retain the manual apply checklist for a developer working
without one.

#### Scenario: Read the merge instructions
- **WHEN** a developer opens the instructions file in `crumb-source/` after a run
- **THEN** its first path is to open an assistant in the project and have it adopt Crumb with the already-installed skill, and a manual, ordered apply checklist follows for doing it by hand

#### Scenario: Manifest fragment is not a whole file
- **WHEN** a developer examines the dependency manifest fragment
- **THEN** it contains only the keys Crumb requires the target to add, in a form the developer merges into their existing manifest, not a complete replacement manifest

#### Scenario: Manifest fragment carries the skill installation command
- **WHEN** a developer merges the manifest fragment and later runs the skill installation command in the target
- **THEN** the command is defined and installs the staged Crumb skills for every supported assistant

## ADDED Requirements

### Requirement: Extraction bootstraps the adopt skill
Running the extract command SHALL leave the `crumb-adopt-existing-project` skill,
and the other shipped Crumb skills, installed in the target's assistant skill
directories, so that an assistant opened in the target can invoke the skill with
no prior manual step. The skill version installed SHALL match the clone the
extract ran from. In preview mode the command SHALL report the skill
installation it would perform and install nothing.

#### Scenario: Use the skill straight after extracting
- **WHEN** a developer runs the extract command against a project and then opens a coding assistant in that project
- **THEN** the `crumb-adopt-existing-project` skill is available to the assistant without the developer having merged anything first

#### Scenario: The extract reports the skill installation
- **WHEN** the extract command finishes
- **THEN** it reports which skill files it installed into the target's assistant directories, separately from the `crumb-source/` staging list

#### Scenario: Preview installs no skill
- **WHEN** the extract command runs in preview mode
- **THEN** it reports the skill files it would install and writes none of them

#### Scenario: Re-extracting refreshes the installed skill
- **WHEN** the extract command runs again from a newer clone
- **THEN** the target's installed Crumb skills are updated to match that clone
