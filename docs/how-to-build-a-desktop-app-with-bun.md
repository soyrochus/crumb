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

`bun run dev` opens the starter in a native window. It watches the application and Crumb kit sources; after a save, it rebuilds the interface and restarts the application. WebView developer tools are available in this development mode only.

Use a one-shot launch when a watcher is inconvenient:

```sh
bun run dev --no-watch
```

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

## 8. Build the standalone executable

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

The output is a raw executable, not an installer or macOS `.app` bundle. It contains the Bun runtime, host code, bundled interface, and target native binding. It needs no adjacent application files, Bun installation, Node.js installation, source checkout, or local server at runtime. The operating system's native WebView libraries remain platform dependencies.

Release builds always disable WebView developer tools, regardless of application configuration.

## 9. Add another application without replacing the starter

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

## What happens during a release build

Crumb uses Bun for both build stages:

1. `Bun.build()` bundles the browser TypeScript, then Crumb inserts the JavaScript and CSS into one HTML document.
2. `Bun.build({ compile: ... })` compiles the host, shared code, embedded document, native binding, and Bun runtime into the target executable.

At runtime the native shell loads that embedded document directly. There is no frontend deployment, localhost port, background server, or source-tree lookup. That is the central constraint when choosing what to build with Crumb: make the interface a client-side web app, and place privileged or machine-local work behind deliberate validated host operations.

For platform dependencies, artifact inspection, and isolated-runtime checks, continue with [Build and runtime support](./build-and-runtime.md) and [Release verification](./verification.md).
