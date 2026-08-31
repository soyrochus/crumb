# How to build a desktop app with Bun

Crumb turns a local web interface into a native desktop application. You write HTML, CSS, and browser TypeScript for the interface, and use Bun for any trusted host-side work. Crumb supplies the native window, embeds the interface, and connects both sides through a small validated message bridge.

The result is not a hosted website and does not start a local web server. In development and in the finished executable, the interface runs inside the operating system's WebView. A release contains the Bun runtime, host code, and application-owned interface in one executable.

Crumb currently targets:

- Apple Silicon on macOS 13 or newer
- Linux x64 on Ubuntu 26.04 with GTK 3, WebKitGTK 4.1, and a native Wayland session

Windows, X11, and XWayland are not supported.

## 1. Install and run the starter

Install [Bun](https://bun.com/) 1.4 or newer, clone Crumb, and install its pinned dependencies:

```sh
git clone https://github.com/soyrochus/crumb.git my-desktop-app
cd my-desktop-app
bun install
bun run dev
```

On macOS, the system WKWebView is sufficient for ordinary development. Linux also needs the packages listed in [Build and runtime support](./build-and-runtime.md#linux).

The TypeScript-only starter needs no Rust toolchain on macOS. If you add a Rust native extension, install stable Rust with [rustup](https://rustup.rs/) and install Apple Command Line Tools with `xcode-select --install`. Linux uses Rust for Crumb's native Wayland binding as well as for application extensions; [rustup](https://rustup.rs/) is the recommended installer there too.

`bun run dev` opens the starter in a native window. It watches the application and Crumb kit sources; after a save, it rebuilds the interface and restarts the application. WebView developer tools are available in this development mode only.

Use a one-shot launch when a watcher is inconvenient:

```sh
bun run dev --no-watch
```

### Start from an existing project instead

If your web application already lives in its own repository, bring Crumb to it
rather than moving it into a clone. From a Crumb clone:

```sh
bun run extract -- --dest /path/to/your-project
```

This does two things. It stages Crumb's template-owned machinery into
`your-project/crumb-source/` — the kit, the full pipeline, the native binding
patch, `main.ts`, `tsconfig.json`, the Crumb skills, and the template `docs/` —
with `fragments/` for the parts that must be merged (`package.json` keys,
`.gitignore` lines, the registry) and a `MERGE.md` checklist. And it installs
the Crumb skills into `your-project/.claude/skills/` (and `.codex/`, `.github/`).
Outside `crumb-source/` it only ever adds those `crumb-` skill directories — no
existing file is modified, and the clone is never touched. `--dry-run` previews;
`--force` re-stages.

Then open a coding assistant in the project and ask it to adopt Crumb. The
`crumb-adopt-existing-project` skill is already installed; it assesses the
project and applies `crumb-source/` — or proposes a migration, or explains why
the project will not fit. `MERGE.md` is the same checklist for doing it by hand.
Once applied, every command in this guide — `bun run dev`, `build`,
`build:native`, `install:skills`, `extract`, `bun test`, `bun run typecheck` —
works in the project with no reference back to the clone, and the rest of this
guide applies unchanged: your interface goes in `src/app/`.

## 2. Know which files are yours

Build the application in `src/app/`:

```text
src/app/
├── app.config.ts          Window, UI entries, policy, and declared operations
├── host/handlers.ts       Trusted Bun-side work
├── shared/contracts.ts    Input and output types shared across the bridge
├── shared/validators.ts   Runtime checks for messages from the WebView
└── ui/
    ├── index.html         Document structure
    ├── styles.css         Interface styles
    └── app.ts             Browser behavior
```

The reusable runtime and bridge live in `src/kit/`. A normal application should not need to change them. The repository-level `app.config.ts` is an application registry; its default entry already points to `src/app/app.config.ts`.

The browser side can use normal DOM and Web APIs that the operating-system WebView supports. It cannot import Bun APIs or Node APIs. Put filesystem access, native integrations, and other privileged work in a host handler instead.

## 3. Build the web interface

Start as you would with a small client-side web app. For example, replace `src/app/ui/index.html` with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"
  >
  <title>Hello desktop</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main>
    <h1>Hello desktop</h1>
    <label for="name">Your name</label>
    <input id="name" autocomplete="name">
    <button id="greet" type="button">Greet me</button>
    <p id="result" aria-live="polite"></p>
  </main>
  <script type="module" src="./app.ts"></script>
</body>
</html>
```

Keep the stylesheet link and script tag in this form. Crumb's UI build replaces them with inline CSS and bundled JavaScript so the finished application does not need adjacent asset files.

Add any layout and visual design to `src/app/ui/styles.css`. No frontend framework is required. If you introduce one, it must produce browser code that Bun can bundle from the configured `uiScript` entry, and it must not depend on a server at runtime.

### Structure a larger interface

A single `app.ts` is enough for one screen, and that is all the starter ships. Past that point, every worked application in this repository splits `ui/` the same way:

| File | Responsibility | Touches the DOM |
| --- | --- | --- |
| `app.ts` | Finds elements, binds events, writes state into the document | Yes |
| `client.ts` | A typed wrapper over `invoke`, one function per declared operation | No |
| `state.ts` | View models, derived values, and request coordination | No |

The split exists so the parts worth testing can be tested. `state.ts` holds no element reference, so `bun test` exercises it directly without a WebView, and `app.ts` stays thin enough that little is lost by leaving it untested.

`client.ts` names each operation once, so the rest of the interface never repeats the generic parameters:

```ts
import { invoke } from "../../kit/ui/bridge";
import type { AppOperations } from "../shared/contracts";

function call<K extends keyof AppOperations & string>(
  method: K,
  input: AppOperations[K]["input"],
): Promise<AppOperations[K]["output"]> {
  return invoke<AppOperations, K>(method, input);
}

export const rpc = {
  greet: (name: string) => call("greet", { name }),
};
```

[`examples/crumbbrot/src/ui/client.ts`](../examples/crumbbrot/src/ui/client.ts) is this file at full size.

### Design within the content security policy

The default policy in section 6 blocks every remote origin, so a Crumb interface has no CDN. Web fonts, icon sets, and images are inlined into `styles.css`, embedded as `data:` URIs, or drawn at runtime — `img-src data:` in the starter policy is what permits the middle option. Treat that as a design constraint from the start rather than discovering it when a font silently fails to load. The build inlines the stylesheet and bundles the script, so nothing sits beside the executable to be fetched later.

## 4. Declare a typed host operation

Code inside a WebView is untrusted at the host boundary, even when it was bundled with the application. A Crumb operation therefore has four parts:

1. a shared TypeScript contract;
2. a runtime validator;
3. a Bun host handler;
4. an entry in the application's operation table.

This example sends a name to Bun and returns a greeting.

First, define the bridge types in `src/app/shared/contracts.ts`:

```ts
export type AppOperations = {
  greet: {
    input: { name: string };
    output: { message: string };
  };
};
```

Then validate the value received from the WebView in `src/app/shared/validators.ts`:

```ts
import {
  expectOnlyKeys,
  ValidationError,
} from "../../kit/shared/validation";

export const validators = {
  greet(raw: unknown): { name: string } {
    const input = expectOnlyKeys(raw, ["name"]);
    if (typeof input.name !== "string") {
      throw new ValidationError("Expected name to be a string");
    }

    const name = input.name.trim();
    if (name.length === 0 || name.length > 80) {
      throw new ValidationError("Enter a name between 1 and 80 characters");
    }
    return { name };
  },
};
```

Validation is runtime security, not just a TypeScript convenience. The host does not run the handler unless its validator accepts the input. Prefer small explicit validators, reject unexpected keys, and put sensible bounds on strings, arrays, and file sizes.

Implement the trusted work in `src/app/host/handlers.ts`:

```ts
export const handlers = {
  greet({ name }: { name: string }): { message: string } {
    return { message: `Hello, ${name}, from Bun ${Bun.version}.` };
  },
};
```

Handlers may be synchronous or asynchronous. They run in the Bun host, so this is where to use Bun APIs, read or write files, call an explicitly allowed service, or integrate with the operating system. Return serializable data; do not pass functions, DOM objects, or other process-local values across the bridge.

Finally, register the operation in `src/app/app.config.ts`:

```ts
import type { ApplicationConfig } from "../kit/shared/config";
import { operation } from "../kit/shared/transport";
import { handlers } from "./host/handlers";
import { validators } from "./shared/validators";

export const starter: ApplicationConfig = {
  name: "Hello desktop",

  window: {
    title: "Hello desktop",
    width: 720,
    height: 520,
    minWidth: 420,
    minHeight: 320,
    resizable: true,
  },

  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  entries: {
    uiScript: "src/app/ui/app.ts",
    uiDocument: "src/app/ui/index.html",
    uiStyles: "src/app/ui/styles.css",
  },

  operations: {
    greet: operation(validators.greet, handlers.greet),
  },
};
```

Only names in `operations` are reachable from the page. Crumb has no fallback filesystem API, shell binding, or generic evaluation route.

## 5. Call Bun from the page

Connect the interface to the declared operation in `src/app/ui/app.ts`:

```ts
import { invoke } from "../../kit/ui/bridge";
import type { AppOperations } from "../shared/contracts";

const name = document.getElementById("name") as HTMLInputElement;
const button = document.getElementById("greet") as HTMLButtonElement;
const result = document.getElementById("result") as HTMLParagraphElement;

button.addEventListener("click", () => {
  button.disabled = true;
  result.textContent = "Working…";

  void invoke<AppOperations, "greet">("greet", { name: name.value })
    .then(({ message }) => {
      result.textContent = message;
    })
    .catch((error: unknown) => {
      result.textContent = error instanceof Error
        ? error.message
        : "The host call failed.";
    })
    .finally(() => {
      button.disabled = false;
    });
});
```

The `AppOperations` map keeps the operation name, input, and output typed in browser code. The validator remains necessary because types do not exist at runtime and page messages can be malformed or hostile.

Save the file while `bun run dev` is active. Crumb reports the changed source, rebuilds the embedded document, and restarts the native window with the new application.

### Keep the interface responsive

Every `invoke` crosses a process boundary and settles later. An interface that fires one request per input event — a drag, a wheel gesture, a window resize — queues work faster than the host retires it, and a slow reply can land after a newer one and overwrite it with a stale result.

Every worked application solves this the same way, and the pattern is worth copying. At most one request is in flight, only the newest waits behind it, and each request carries a generation number that is re-checked before its result is applied:

```ts
export class RenderCoordinator {
  private generation = 0;
  private active = false;
  private queued: { generation: number; input: RenderFractalInput } | null = null;

  request(input: RenderFractalInput): void {
    this.queued = { generation: ++this.generation, input };
    if (!this.active) void this.drain();
  }

  private async drain(): Promise<void> {
    this.active = true;
    while (this.queued) {
      const request = this.queued;
      this.queued = null;
      const frame = await this.render(request.input);
      if (request.generation === this.generation) this.onFrame(frame);
    }
    this.active = false;
  }
}
```

Intermediate requests are dropped rather than rendered, and a superseded reply is discarded rather than drawn. [Crumbbrot's coordinator](../examples/crumbbrot/src/ui/state.ts) is this class with error handling and a busy-state callback added; the activity monitor applies the same generation check separately to its refresh and to its per-process detail request, so selecting a process cannot be overwritten by an earlier selection. Because the coordinator receives its `render` function as a constructor argument, tests pass a fake one and assert the coalescing behavior with no window open.

### Move large or binary results

The bridge carries JSON text in both directions: the page serializes the input, and the host replies with `JSON.stringify`. A handler cannot return a `Uint8Array`, an `ArrayBuffer`, or a `Blob` and have it arrive as that type — a typed array survives the trip as an object keyed by digits.

Encode binary payloads explicitly on the host and decode them in the page. Crumbbrot returns rendered pixels as base64 and rebuilds an `ImageData` for its canvas. Budget for the cost, because it is paid on every message: base64 adds a third to the payload, and for a 1600×1200 RGBA frame that is 7.68 MB of pixels travelling as 10.24 MB of text, with the page-side decode costing noticeably more than the host-side encode. Where the interface only needs a summary, return the summary rather than the bulk data.

## 6. Keep the app local and secure

Crumb's default Content Security Policy blocks network connections, remote scripts, forms, frames, object embedding, and unintended navigation. Keep that policy unless the application genuinely needs a wider capability.

The policy appears in two places for two stages of the build:

- `src/app/ui/index.html` uses `'self'` for its source stylesheet and script.
- `src/app/app.config.ts` uses `'unsafe-inline'` because the production build embeds both into the final HTML document.

If you intentionally change the policy, update both declarations consistently. Treat `connect-src`, script execution, and navigation as security boundaries rather than as fixes for a failing request.

For local files, send an explicit, narrowly shaped request to a host operation. Validate paths with `normalizeAbsolutePath()` from `src/kit/shared/validation.ts`, constrain reads and writes, and return safe domain data. Do not expose a generic “run command,” “read anything,” or `eval` operation to the page.

Application state is in memory unless your own host handlers persist it. If the app writes settings or user data, make the destination and behavior explicit and test failure cases such as missing files and denied permissions.

## 7. Test before building

Run the standard local checks:

```sh
bun test
bun run typecheck
```

Tests use Bun's test runner. Add application tests under `test/` or beside a separately registered example, and test validators and handlers without going through the WebView whenever possible.

You can also inspect the generated single-document interface:

```sh
bun run build:ui
```

This writes `dist/ui.html`. It is a build artifact for inspection, not a page that the release loads from disk.

## 8. Add a Rust native extension (optional)

Use a Rust extension when trusted host work needs native performance, an existing native library, or operating-system access that is impractical in TypeScript. Extensions run inside the Bun host process and are reached only from trusted host code, through a declared operation exactly like the one in sections 4 and 5. The WebView never imports or selects a native module itself, and Crumb exposes no way for it to try.

An extension is an application-owned Node-API `cdylib` crate that you declare by logical name in `app.config.ts`. Crumb compiles it with `cargo build --release --locked`, verifies the artifact, embeds it in the standalone executable, and reports any non-system dynamic dependency it introduces. Rust is optional on macOS for a TypeScript-only application; Linux uses it for Crumb's own native binding regardless.

The complete walkthrough — toolchain setup, the crate shape, a minimal working module, declaration, the development loop, the two worked examples, and the security posture that native code demands — is in [Rust native extensions](./native-extensions.md).

## 9. Build the standalone executable

Build releases on the operating system they target. Cross-platform release builds are intentionally rejected until the native binding combination has been verified.

On Apple Silicon macOS:

```sh
bun run build --target=macos-arm64
./dist/starter-macos-arm64
```

On Linux x64 under Wayland:

```sh
bun run build --target=linux-x64
./dist/starter-linux-x64
```

Choose a product-oriented output name with `--output`:

```sh
bun run build --target=macos-arm64 --output=hello-desktop
./dist/hello-desktop-macos-arm64
```

The output is a raw executable, not an installer or macOS `.app` bundle. It contains the Bun runtime, host code, bundled interface, target native binding, and every Rust extension declared by the selected application. It needs no adjacent application files, Bun installation, Node.js installation, Rust toolchain, source checkout, or local server at runtime. The operating system's native WebView libraries and any non-system dynamic libraries reported by the extension inspection remain platform dependencies.

Release builds always disable WebView developer tools, regardless of application configuration.

## 10. Add another application without replacing the starter

For a second application, copy the `src/app/` shape to a new directory, give it an `ApplicationConfig`, and register it in the repository-level `app.config.ts`:

```ts
import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";
import { notes } from "./examples/notes/app.config";

export const registry: ApplicationRegistry = {
  default: "starter",
  applications: {
    starter,
    notes,
  },
};
```

Select it by registry key during development or release:

```sh
bun run dev --example=notes
bun run build --example=notes --target=macos-arm64
```

The flag is called `--example` because the repository ships its worked applications under `examples/`, but registered applications are first-class build targets. An unknown name fails immediately and lists the available entries.

## 11. Give a coding assistant the template's ceremonies

Several of the steps above span files that must agree: an operation is five
parts, a native extension is a crate shape plus a declaration plus a validated
operation, and the security policy is declared twice. A coding assistant that
has not read this guide will get those almost right.

Crumb ships that knowledge as skills. `skills/` is the canonical source and
names no assistant; one command installs the copies each one reads:

```sh
bun run install:skills
```

That writes into `.claude/skills/`, `.codex/skills/`, and `.github/skills/`.
Narrow it with `--target=<assistant>`, preview it with `--list`, and verify the
committed copies with `--check`. The installer only creates and replaces the
skill names `skills/` contains: skills another tool put in those directories, or
that you wrote yourself, are left alone, and a skill you delete from `skills/`
is left installed rather than removed.

Edit skills in `skills/` and reinstall — a change made to an installed copy is
overwritten by the next run. A skill is a shortcut to this guide, not a
replacement for it: where a skill disagrees with this document or with a
requirement under `openspec/specs/`, the document and the requirement govern.

Skills are repository material only. They change nothing about the host, the
build pipeline, or the executable, and none of the workflows above depend on
having installed them.

## What happens during a release build

Crumb owns all build stages:

1. Crumb validates every declared native extension, runs `cargo build --release --locked` for missing or stale crates, and verifies each produced artifact.
2. `Bun.build()` bundles the browser TypeScript, then Crumb inserts the JavaScript and CSS into one HTML document.
3. `Bun.build({ compile: ... })` compiles the host, shared code, embedded document, native binding, declared extensions, and Bun runtime into the target executable.

At runtime the native shell loads that embedded document directly. There is no frontend deployment, localhost port, background server, or source-tree lookup. That is the central constraint when choosing what to build with Crumb: make the interface a client-side web app, and place privileged or machine-local work behind deliberate validated host operations.

For Rust extensions, continue with [Rust native extensions](./native-extensions.md). For platform dependencies, artifact inspection, and isolated-runtime checks, continue with [Build and runtime support](./build-and-runtime.md) and [Release verification](./verification.md).
