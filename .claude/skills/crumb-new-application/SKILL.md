---
name: crumb-new-application
description: Use when adding a second application to a Crumb repository, or when changing an application's window, entry points, or Content Security Policy — including scaffolding a new example alongside the starter rather than replacing it.
---

# Scaffold a new registered application

A Crumb repository can build several applications. `src/app/` is the starter;
additional applications live in their own directory and are registered in the
repository-level `app.config.ts`. A registered application is a first-class
build target — not copied-in source and not a fork of the starter.

## The shape

Copy the starter's structure to a new directory, for example
`examples/notes/`:

```text
app.config.ts       the ApplicationConfig this application exports
host/handlers.ts    trusted Bun code
shared/contracts.ts the AppOperations map
shared/validators.ts one validator per operation
ui/index.html       the source document
ui/app.ts           the page's entry script
ui/styles.css       the page's stylesheet
```

## The config

Export one `ApplicationConfig`. `entries` paths are relative to the
**repository root**, not to the application directory:

```ts
import type { ApplicationConfig } from "../../src/kit/shared/config";
import { operation } from "../../src/kit/shared/transport";
import { handlers } from "./host/handlers";
import { validators } from "./shared/validators";

export const notes: ApplicationConfig = {
  name: "Notes",
  window: { title: "Notes", width: 720, height: 520, minWidth: 420, minHeight: 320, resizable: true },
  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
  entries: {
    uiScript: "examples/notes/ui/app.ts",
    uiDocument: "examples/notes/ui/index.html",
    uiStyles: "examples/notes/ui/styles.css",
  },
  operations: {
    // See the crumb-add-operation skill for the five parts each one needs.
  },
};
```

There is no field that enables WebView developer tools. That comes from how the
process was started, so a release build cannot express the unsafe state — do not
try to add one.

## The registry entry

Register it in the repository-level `app.config.ts`. The key is the name
`--example=` selects:

```ts
export const registry: ApplicationRegistry = {
  default: "starter",
  applications: {
    starter,
    notes,
  },
};
```

Unregistered, the application cannot be run or built at all. An unknown
`--example` name fails immediately and lists what is available.

## Selection

The same flag works across every command that acts on an application:

```sh
bun run dev --example=notes
bun run build --example=notes --target=macos-arm64
bun run rebuild:extensions --example=notes
```

The artifact is named after the selected application (`dist/notes-macos-arm64`);
`--output=<name>` overrides the stem. The flag is called `--example` because the
repository ships its worked applications under `examples/`, but a registered
application is a normal build target.

## The dual-CSP invariant

**The policy is declared twice, in two forms, and both must be updated
together.**

- `ui/index.html` uses `script-src 'self'; style-src 'self'` — in development
  the script and stylesheet are separate files the document links to.
- `app.config.ts` uses `script-src 'unsafe-inline'; style-src 'unsafe-inline'` —
  the release build inlines both into a single embedded HTML document, so they
  are inline content by the time the policy applies.

They differ because the two stages load the same code differently. Change one
without the other and you get the worst kind of failure: an application that
works under `bun run dev` and breaks on the release build, or one that silently
loses a restriction it appeared to have. Treat `connect-src`, script execution,
and navigation as security boundaries rather than as knobs to loosen when a
request fails.

## Ownership

`src/app/` and your own application directory are yours. `src/kit/` is the
template's: window bootstrap, RPC router, browser bridge, validation
primitives, platform detection, transport types. A normal application does not
modify it.

Nothing under `src/kit/` imports from an application, and the kit names no
operation — that is verified, not aspirational. If a task seems to require
editing the kit, that is a signal the design is wrong or the template has a
genuine gap worth raising, not a step to take quietly.

## Beyond the ceremony

Section 10 of
[`docs/how-to-build-a-desktop-app-with-bun.md`](../../docs/how-to-build-a-desktop-app-with-bun.md)
covers registration and selection, and section 6 covers the security policy; the
requirements under [`openspec/specs/`](../../openspec/specs/) are normative.
Where this skill disagrees with either, they govern and this skill is what gets
corrected.
