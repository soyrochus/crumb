## MODIFIED Requirements

### Requirement: Staged set is the template machinery only
The staged file set SHALL make the target a self-contained Crumb template: the
reusable kit, the full development and build pipeline, the native binding patch,
the release entry point, the strict TypeScript configuration, the template's own
tests, the shipped assistant skills together with their installed copies for
every supported assistant, and the template documentation the skills reference.
It MUST NOT contain the starter application, any worked example application, an
example's Rust crate, application-owned source, or a check that depends on a
worked example. The set SHALL be defined by an explicit allowlist, and the
command SHALL fail if any allowlisted path is absent from the clone.

#### Scenario: Inspect what was staged
- **WHEN** a developer examines the `crumb-source/` directory after a successful run
- **THEN** it contains the kit, the full pipeline, the native patch, the release entry point, the TypeScript configuration, the `skills/` source, the template `docs/`, and the installed skill copies, and it contains no starter application, example application, or example crate

#### Scenario: Example-only checks are excluded
- **WHEN** the staged pipeline and tests are examined
- **THEN** the scripts that verify a worked example are absent, the kit tests that assert against the repository's own example registry are absent, no staged file imports from an example, and no example application source is present

#### Scenario: The staged kit tests pass against the target's own registry
- **WHEN** a developer runs the test command in an applied target whose registry is the trimmed single-application fragment
- **THEN** the staged kit tests pass, because none of them assumes the source repository's example applications

#### Scenario: Only Crumb's own skills are staged
- **WHEN** the staged installed skill copies are examined
- **THEN** they are the skills whose names carry the template's `crumb-` prefix, and skills another tool installed into the same assistant directories are not among them

#### Scenario: The template has been refactored and an allowlisted path is gone
- **WHEN** the extract command runs against a clone in which an allowlisted path no longer exists
- **THEN** it fails with a message identifying the missing path and stages nothing

### Requirement: Merge-required content is delivered as fragments and instructions
The command SHALL deliver content that a target project must combine with its
own equivalents — dependency manifest entries, ignore rules, and the application
registry — as separate fragment files together with ordered written
instructions. The command MUST NOT deliver that content as drop-in replacements
for the target's existing files. The dependency manifest fragment SHALL include
every Crumb script that functions in a target without the worked examples,
including the skill installation command. The instructions SHALL record which
Crumb version the staged set was taken from, and SHALL cover applying the staged
skills and their installed copies alongside the rest of the tree.

#### Scenario: Read the merge instructions
- **WHEN** a developer opens the instructions file in `crumb-source/` after a run
- **THEN** it lists, in order, the steps to apply the staged files — the pipeline, the skills, and their installed copies — merge the manifest and ignore fragments, place a trimmed application registry, and add their own interface under `src/app/`, and it names the Crumb version the staged set came from

#### Scenario: Manifest fragment is not a whole file
- **WHEN** a developer examines the dependency manifest fragment
- **THEN** it contains only the keys Crumb requires the target to add, in a form the developer merges into their existing manifest, not a complete replacement manifest

#### Scenario: Manifest fragment carries the skill installation command
- **WHEN** a developer merges the manifest fragment and later runs the skill installation command in the target
- **THEN** the command is defined and installs the staged Crumb skills for every supported assistant

### Requirement: An assistant skill applies the extracted files into a project
The template SHALL ship an assistant skill, in the canonical skill source and
therefore in every supported assistant's installed copies, that carries the
project-specific work of turning an extracted `crumb-source/` into a running
Crumb application inside an existing project. Before applying anything, the skill
SHALL direct an assistant to assess whether the project can become a Crumb
application — a client-side interface, a single browser bundle with no runtime
server, backend work that can move into host operations, and a supported
platform — and SHALL require one of three explicit outcomes: apply the merge,
propose a staged migration for the developer to approve, or state that adoption
is not feasible and name the blocker. The skill MUST NOT direct an assistant to
apply a partial result that leaves the project unable to build, and SHALL
require the work to happen under the developer's version control with changes
left for review. When applying, the skill SHALL cover moving the staged tree
into place, merging the dependency manifest and reconciling script-name
collisions without dropping a script silently, reconciling the TypeScript
configuration, mapping an existing interface into `src/app/` with backend calls
becoming declared operations, creating the application registry, and verifying a
working build, test, and development run. The skill SHALL defer to `MERGE.md`
and the how-to guide for the ceremony and MUST NOT restate what it can
reference, consistent with skills being subordinate to the documentation.

#### Scenario: Assess before applying
- **WHEN** an assistant is asked to adopt Crumb into an existing project
- **THEN** it first evaluates the interface, the build, the backend, and the platform against Crumb's constraints, and states which of apply / propose-migration / decline it is taking and why

#### Scenario: The project cannot shed its server
- **WHEN** the project's interface depends on a backend that serves external clients or holds server-only secrets
- **THEN** the skill has the assistant report that adoption is not feasible and why, rather than partially applying the staged files

#### Scenario: Apply resolves script collisions explicitly
- **WHEN** the merge finds the project already defines `dev`, `build`, `test`, or `start`
- **THEN** the assistant assigns the standard names to Crumb's scripts, renames the incumbents, and reports the renames — it does not leave two definitions or drop one silently

#### Scenario: Apply is verified, not assumed
- **WHEN** the assistant finishes applying the staged files
- **THEN** it runs the type check, tests, skill-copy check, and development command, and treats a failure as unfinished work rather than handing back a broken tree

#### Scenario: Skill is installed for every supported assistant
- **WHEN** the skill installation command runs
- **THEN** the adopt-existing-project skill is installed into every supported assistant's location alongside the other shipped skills, and `--check` verifies its committed copies

#### Scenario: Skill and documentation disagree
- **WHEN** the skill's guidance conflicts with `MERGE.md` or the how-to guide
- **THEN** the documentation governs and the skill is corrected

## ADDED Requirements

### Requirement: Extracted target is decoupled from the source clone
Once the staged files are applied, the target SHALL depend on the source clone
for nothing. Every development, build, and skill command the project
documentation describes SHALL run in the target without reading any path outside
it. A reference a shipped skill makes to material the extract does not carry
SHALL resolve to the canonical Crumb repository rather than to a clone-relative
path.

#### Scenario: Run the documented commands in an applied target
- **WHEN** a developer has applied `crumb-source/` into a project and runs the development, build, native-build, UI-build, extension-rebuild, skill-installation, test, and type-check commands
- **THEN** each command resolves and runs using only files inside the target project

#### Scenario: Install the skills in the target
- **WHEN** a developer runs the skill installation command in an applied target
- **THEN** it succeeds, installing the Crumb skills for every supported assistant, with no step requiring the source clone

#### Scenario: Follow a skill's reference to the normative specifications
- **WHEN** a developer or assistant follows a shipped skill's pointer to the normative Crumb specifications from within the target
- **THEN** the pointer is the canonical Crumb repository location, not a path that assumes the clone's layout

#### Scenario: Template documentation the skills cite is present
- **WHEN** a shipped skill in the applied target references the build-and-ship how-to
- **THEN** that document is present in the target and the reference resolves locally
