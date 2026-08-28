# Crumb's agent skills

This directory is the canonical source for the skills Crumb ships for coding
assistants. It is template-owned material: you inherit it when you clone the
template, and it is the only copy that is edited by hand.

Nothing here names an assistant or a vendor. A skill describes how to work in
this repository; where an assistant looks for it is the installer's problem,
not the skill's.

## Installing

```sh
bun run install:skills                    # every supported assistant
bun run install:skills --target=claude    # one assistant
bun run install:skills --list             # what a run would write, writing nothing
bun run install:skills --check            # fail if an installed copy is stale
```

The installer copies each `skills/<name>/` directory into the place every
supported assistant reads. Those copies are **generated**, and they are also
committed, so a fresh clone works with an assistant before anyone runs a
command. That is why they can go stale, and why `--check` exists.

Edit a skill here and reinstall. An edit made directly to an installed copy is
overwritten by the next run without warning.

The installer is additive. It creates and replaces only the skill names this
directory contains and never deletes, rewrites, or reorganizes anything else in
an assistant's directory — the OpenSpec CLI writes its own skills into the same
directories, and the two must not fight. Removing a skill from here therefore
leaves the installed copies behind; delete those yourself.

## Authoring a skill

A skill is a directory containing `SKILL.md`, which opens with YAML
frontmatter:

```yaml
---
name: crumb-add-operation
description: Use when adding, changing, or reviewing a host operation a Crumb page can call — the four-file ceremony and its runtime validator.
---
```

- `name` matches the directory name and carries the `crumb-` prefix. The prefix
  keeps Crumb's skills collision-free and legible in a directory shared with
  another tool's output.
- `description` states the **trigger condition**, not the topic: it is what an
  assistant matches a task against, so write what the developer is doing when
  this skill should fire, not what the skill is about. "Use when adding a Rust
  native extension" fires; "About native extensions" does not.

A skill is a shortcut to the documented workflow, never a competing
description of it. Carry the ceremony, the file list, and the invariants — the
parts that only change when the template's structure changes — and point at
[`docs/how-to-build-a-desktop-app-with-bun.md`](../docs/how-to-build-a-desktop-app-with-bun.md)
and the requirements under [`openspec/specs/`](../openspec/specs/) for
everything else. Where a skill and a specification disagree, the specification
governs and the skill is the thing that gets corrected.
