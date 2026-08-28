## REMOVED Requirements

### Requirement: Restrictive document policy
**Reason**: The Content Security Policy is a template guarantee, not a property of the three-pane example UI. Every application built on Crumb needs it, and none of it describes panes, separators, or previews. Leaving it here would mean an application that deletes the example also deletes its document policy.

**Migration**: Moved verbatim in substance to `desktop-shell` → "Restrictive document policy", where it is stated as a template default that an application may widen only by explicit declaration. The policy applied to the running example is unchanged; `src/ui/index.html` and the host `csp` option are not modified by this change.
