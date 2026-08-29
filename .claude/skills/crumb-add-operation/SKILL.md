---
name: crumb-add-operation
description: Use when adding, changing, or reviewing an operation the page calls on the host in a Crumb application — anything the interface needs Bun to do, such as reading a file, calling the operating system, or reaching native code.
---

# Add a validated host operation

Code inside the WebView is untrusted at the host boundary, even though the
application bundled it. An operation is the only way the page reaches the host,
and it has five parts that must all be present. Adding four of them produces an
application that compiles, runs, and is wrong.

## The ceremony

For the starter application. A registered application under `examples/` has the
same five parts under its own directory.

1. **The shared contract** — `src/app/shared/contracts.ts`. Add an entry to
   `AppOperations` naming the operation's input and output types.

   ```ts
   export type AppOperations = {
     greet: { input: { name: string }; output: { message: string } };
   };
   ```

2. **The runtime validator** — `src/app/shared/validators.ts`. One validator per
   operation, turning `unknown` into the checked input type.

   ```ts
   import { expectOnlyKeys, ValidationError } from "../../kit/shared/validation";

   export const validators = {
     greet(raw: unknown): { name: string } {
       const input = expectOnlyKeys(raw, ["name"]);
       if (typeof input.name !== "string") throw new ValidationError("Expected name to be a string");
       const name = input.name.trim();
       if (name.length === 0 || name.length > 80) throw new ValidationError("Enter a name between 1 and 80 characters");
       return { name };
     },
   };
   ```

3. **The host handler** — `src/app/host/handlers.ts`. Synchronous or async, runs
   in the trusted Bun process, takes the *checked* input.

   ```ts
   export const handlers = {
     greet({ name }: { name: string }): { message: string } {
       return { message: `Hello, ${name}, from Bun ${Bun.version}.` };
     },
   };
   ```

4. **The `operations` entry** — `src/app/app.config.ts`. Pair the validator and
   the handler with `operation()`.

   ```ts
   operations: {
     greet: operation(validators.greet, handlers.greet),
   },
   ```

5. **The typed call site** — `src/app/ui/app.ts`. `invoke` is generic over the
   operation map, so the page keeps end-to-end types across the bridge.

   ```ts
   void invoke<AppOperations, "greet">("greet", { name: input.value })
     .then(({ message }) => { result.textContent = message; })
     .catch((error: unknown) => {
       result.textContent = error instanceof Error ? error.message : "The host call failed.";
     });
   ```

Only names present in `operations` are reachable. There is no fallback
filesystem API, shell binding, or generic evaluation route, so a missing entry
is not a degraded operation — it is no operation at all.

## The validator is a security boundary

Not a type-level convenience. TypeScript types do not exist at runtime, and a
page message can be malformed or hostile regardless of what the contract says.
The router does not run a handler whose validator rejected its input: validation
runs first, and a thrown `ValidationError` becomes an `INVALID_INPUT` result
without the handler being called.

Never skip the validator because the input "is just" a string the application
itself supplies, and never write one that returns `raw as T`.

## Validator conventions

- Reject unexpected keys — `expectOnlyKeys(raw, [...])`, or `expectNoKeys(raw)`
  for an operation that takes no arguments.
- Bound everything unbounded: string lengths, array lengths, and the size of
  anything the handler will read.
- Normalize every path with `normalizeAbsolutePath()` from
  `src/kit/shared/validation.ts` rather than trusting the string, and constrain
  what the handler then reads or writes.
- Prefer several small explicit validators over one clever shared one.
- Never expose a generic "run this command", "read any path", or `eval`
  operation. That hands the page the host's full permissions and makes every
  other validator pointless.

## The return boundary

Handlers return serializable data. Do not send functions, DOM objects, class
instances that rely on their prototype, or other process-local values across the
bridge — the response is JSON. Failures should be thrown; the kit normalizes
them into a `DomainError` with a code the page can act on.

## Beyond the ceremony

Section 4 of
[`docs/how-to-build-a-desktop-app-with-bun.md`](../../docs/how-to-build-a-desktop-app-with-bun.md)
is the authoritative walkthrough, and the requirements under
[`openspec/specs/`](https://github.com/soyrochus/crumb/tree/main/openspec/specs/) are normative. Where this skill
disagrees with either, they govern and this skill is what gets corrected.
