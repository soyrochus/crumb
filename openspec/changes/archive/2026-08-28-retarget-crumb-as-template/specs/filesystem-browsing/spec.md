## MODIFIED Requirements

### Requirement: Read-only filesystem implementation
The `file-explorer` example application SHALL be view-only, a constraint it adopts to keep its own implementation simple and auditable rather than one the template imposes. All of its production filesystem access SHALL be owned by the Bun host and SHALL use inspection and bounded-read APIs only. Its production code MUST NOT call filesystem creation, writing, copying, moving, renaming, deletion, permission, ownership, or link-creation APIs and MUST NOT invoke a shell. The static check that enforces this SHALL cover the example application's source and SHALL NOT be applied to template-owned source or to other applications built on the template.

#### Scenario: Static read-only review
- **WHEN** the example application's production source is searched for mutation and shell-execution APIs
- **THEN** no application call to such an API exists outside test setup and teardown code

#### Scenario: Build a writing application on the template
- **WHEN** a different application built on the template calls filesystem writing APIs
- **THEN** the example's read-only check does not apply to it and does not fail its build
