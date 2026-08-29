# Migrating Brainflip to Crumb

A worked migration guide: taking the existing **Brainflip** memory game (vanilla
JS front end + Node/Express and Python/Flask backends) and running it as a Crumb
desktop application, without moving the Brainflip repository into a Crumb clone.

This document lives in `specs/` alongside `crumbot-skill-demo.md`: it is a
project-specific exercise, not template documentation, and is deliberately **not**
under `docs/` (which `bun run extract` stages into every target).

---

## Verdict: adopt with a small migration

Assessed against Crumb's constraints (see the `crumb-adopt-existing-project`
skill):

| Question | Brainflip | Consequence |
| --- | --- | --- |
| Client-side interface? | Yes — `public/index.html` is one file: markup, a `<style>` block, and one `<script>` with all game logic. | Maps to `src/app/ui/` almost directly. |
| Single browser bundle, no runtime server? | Almost. Breakers: `<script src="https://cdn.tailwindcss.com">`, images served from `/images/*`, two `fetch('/api/scores')` calls. | Vendor Tailwind, embed images, replace `fetch` with host operations. |
| Backend can move into the host? | Yes, entirely. The backend is "read/write `scores.txt`, keep top 5, validate a non-negative integer" (`server/services/scoresService.js`). No users, no external clients, no secrets. | Becomes two Bun host operations. |
| Platform | macOS arm64 / Linux Wayland, one window — fine for a game. | No blocker. |

Estimated effort: a few hours. The only genuine build-tooling change is Tailwind.

Work on the existing `convert-to-crumb` branch, commit in stages, keep the
Express server runnable in parallel until parity is confirmed.

---

## Prerequisites

- Bun 1.4+ on macOS arm64 or Linux (Wayland). See the Crumb README for the
  Linux system packages and (only if a Rust extension is later added) rustup.
- `crumb-source/` already present in the Brainflip repo. If not, from a Crumb
  clone: `bun run extract -- --dest /path/to/brainflip`.

---

## Phase 1 — Apply the Crumb machinery

### 1.1 Move the staged tree into place

From `crumb-source/`, move to the Brainflip root at the same relative path:

```
src/kit/   scripts/   native/   test/kit/   skills/   docs/
.claude/skills/   .codex/skills/   .github/skills/
main.ts   tsconfig.json
```

Collisions to handle by hand:

- **`.github/`** already exists (`workflows/`, `prompts/`). Merge `.github/skills/`
  in beside them; do not replace `.github/`.
- Brainflip has `tests/` (Playwright specs) — unrelated to the staged `test/kit/`.
  Leave it; Crumb's `tsconfig.json` only includes `src/`, `scripts/`, `test/`.

### 1.2 Merge the `package.json` fragment

`crumb-source/fragments/package.json` carries `type`, `scripts`, `dependencies`,
`devDependencies`. Brainflip's `dev`, `start`, and `test` collide — rename the
incumbents, give the standard names to Crumb:

```jsonc
{
  "type": "module",
  "scripts": {
    "start:express": "node server/app.js",
    "dev:express": "nodemon server/app.js",
    "test:e2e": "playwright test",

    "dev": "bun run scripts/dev.ts",
    "build": "bun run scripts/build.ts",
    "build:native": "bun run scripts/build-native.ts",
    "build:ui": "bun run scripts/build-ui.ts",
    "rebuild:extensions": "bun run scripts/rebuild-extensions.ts",
    "extract": "bun run scripts/extract.ts",
    "install:skills": "bun run scripts/install-skills.ts",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@nativewindow/webview": "1.0.6"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.1",
    "@types/node": "^24.10.1",
    "@types/bun": "1.4.0",
    "nodemon": "^3.1.7",
    "typescript": "7.0.2"
  }
}
```

Keep `express` and `nodemon` for now — they go in Phase 7. Brainflip's old
`test` (`node --version`) is dropped.

### 1.3 `.gitignore`

Append `crumb-source/fragments/gitignore`:

```
node_modules/
dist/
.build/
```

### 1.4 Install and verify the machinery

```sh
bun install
bun run install:skills --check   # staged skill copies are in sync
bun test test/kit/               # kit tests pass
```

`bunx tsc --noEmit` will still fail here — `main.ts` imports `./src/app/app.config`,
which does not exist yet. That is Phase 2–3.

---

## Phase 2 — Root registry

```sh
cp crumb-source/fragments/app.config.ts ./app.config.ts
```

It is the trimmed single-application registry:

```ts
import type { ApplicationRegistry } from "./src/kit/shared/config";
import { starter } from "./src/app/app.config";

export const registry: ApplicationRegistry = {
  default: "starter",
  applications: { starter },
};
```

---

## Phase 3 — Build the interface into `src/app/`

Target shape:

```
src/app/
├── app.config.ts
├── host/handlers.ts
├── shared/contracts.ts
├── shared/validators.ts
└── ui/
    ├── index.html
    ├── styles.css
    └── app.ts
```

### 3.1 `src/app/ui/index.html`

Start from `public/index.html`:

- Keep the `<body>` markup (`#grid`, `#score`, `#win`, `#play-again`,
  `#top-scores-list`, etc.).
- **Remove** `<script src="https://cdn.tailwindcss.com">` — Crumb's CSP blocks
  remote scripts.
- **Remove** `<link rel="icon" href="/images/favicon.png">` — a WebView window
  has no favicon.
- Move the `<style>` block into `styles.css`.
- Replace the inline `<script>` with `<script type="module" src="./app.ts">` and
  add `<link rel="stylesheet" href="./styles.css">` in `<head>`.
- Add the development CSP meta tag:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
```

Crumb's UI build inlines the stylesheet and script into one document, so the
release CSP (in `app.config.ts`) uses `'unsafe-inline'` instead — see 3.8 and the
dual-CSP note.

### 3.2 Tailwind

The page uses a fixed set of Tailwind utility classes (`bg-blue-50`,
`aspect-[4/5]`, `sm:w-24`, `disabled:opacity-50`, …). Two options:

- **Recommended — compile once, ship static CSS.** Run the Tailwind CLI over the
  markup and scripts, commit the output as part of `styles.css`, no Tailwind at
  runtime:

  ```sh
  bunx tailwindcss -i ./tailwind-input.css -o ./src/app/ui/styles.css \
    --content './src/app/ui/index.html,./src/app/ui/app.ts' --minify
  ```

  Append the existing `<style>` rules (card 3D flip / flop / backflip
  animations, reduced-motion) to the generated file.

- **Simpler — vendor the full build.** Download a built `tailwind.css` into
  `src/app/ui/` and `@import` it from `styles.css`. Larger, no build step.

Either way, no `cdn.tailwindcss.com`.

### 3.3 Card images

`public/images/` holds `front1.png`–`front8.png` and `back.png` (9 PNGs; the
`.xcf` sources and `favicon.*` are not needed). Crumb's default CSP allows
`img-src data:`, so embed them:

```ts
// src/app/ui/images.ts  — generate this file once
export const frontImages: string[] = [
  "data:image/png;base64,<...front1...>",
  // ...front2 – front8
];
export const backImage = "data:image/png;base64,<...back...>";
```

Generate it with a small script (`Bun.file(p).arrayBuffer()` →
`Buffer.from(...).toString("base64")`). Then in `app.ts` the deck is built from
`frontImages` / `backImage` instead of `'/images/front1.png'` etc.

### 3.4 `src/app/ui/app.ts`

Port the inline `<script>` (game state, `shuffle`, `getDeck`, `createCard`,
`onCardClick`, scoring, peek helpers, win handling). Two substantive changes:

- **Image sources:** replace the `cardImages`/`backImage` string literals with
  the imports from `images.ts` (3.3).
- **Score persistence:** replace the two `fetch` calls.

```ts
import { invoke } from "../../kit/ui/bridge";
import type { AppOperations } from "../shared/contracts";

async function loadTopScores(): Promise<void> {
  try {
    const { scores } = await invoke<AppOperations, "getScores">("getScores", {});
    displayTopScores(scores);
  } catch (error) {
    console.error("Failed to load top scores:", error);
  }
}

async function submitScore(finalScore: number): Promise<void> {
  try {
    const { topScores } = await invoke<AppOperations, "submitScore">(
      "submitScore",
      { score: finalScore },
    );
    displayTopScores(topScores);
  } catch (error) {
    console.error("Failed to submit score:", error);
  }
}
```

`displayTopScores` is unchanged. The `?debug=true` URL check
(`new URLSearchParams(window.location.search)`) will not see a query string on
the embedded document — move debug mode to a keyboard shortcut, a `localStorage`
flag, or a build-time constant.

### 3.5 `src/app/shared/contracts.ts`

```ts
export type AppOperations = {
  getScores: {
    input: Record<string, never>;
    output: { scores: number[] };
  };
  submitScore: {
    input: { score: number };
    output: { topScores: number[] };
  };
};
```

### 3.6 `src/app/shared/validators.ts`

```ts
import { expectOnlyKeys, ValidationError } from "../../kit/shared/validation";

export const validators = {
  getScores(raw: unknown): Record<string, never> {
    expectOnlyKeys(raw, []);
    return {};
  },

  submitScore(raw: unknown): { score: number } {
    const input = expectOnlyKeys(raw, ["score"]);
    const score = input.score;
    if (typeof score !== "number" || !Number.isInteger(score)) {
      throw new ValidationError("score must be an integer");
    }
    if (score < 0 || score > 100_000) {
      throw new ValidationError("score out of range");
    }
    return { score };
  },
};
```

Validation is a runtime security boundary, not a type convenience — the page
message can be anything.

### 3.7 `src/app/host/handlers.ts`

Port `server/services/scoresService.js` (load → parse ints → sort desc → top 5;
save → append → sort → trim → write). A released executable runs from an
arbitrary directory, so the scores file must live somewhere writable and stable:

```ts
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const MAX_TOP_SCORES = 5;
const dir = join(homedir(), ".brainflip");
const file = join(dir, "scores.txt");

async function load(): Promise<number[]> {
  const text = await Bun.file(file).text().catch(() => "");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line, 10))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a)
    .slice(0, MAX_TOP_SCORES);
}

export const handlers = {
  async getScores(): Promise<{ scores: number[] }> {
    return { scores: await load() };
  },

  async submitScore({ score }: { score: number }): Promise<{ topScores: number[] }> {
    const top = [...(await load()), score].sort((a, b) => b - a).slice(0, MAX_TOP_SCORES);
    await mkdir(dir, { recursive: true });
    await Bun.write(file, top.map(String).join("\n") + "\n");
    return { topScores: top };
  },
};
```

One-time data carry-over: copy the existing `server/storage/scores.txt` to
`~/.brainflip/scores.txt`.

### 3.8 `src/app/app.config.ts`

```ts
import type { ApplicationConfig } from "../kit/shared/config";
import { operation } from "../kit/shared/transport";
import { handlers } from "./host/handlers";
import { validators } from "./shared/validators";

export const starter: ApplicationConfig = {
  name: "Brainflip",

  window: {
    title: "Brainflip",
    width: 900,
    height: 820,
    minWidth: 480,
    minHeight: 600,
    resizable: true,
  },

  csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",

  entries: {
    uiScript: "src/app/ui/app.ts",
    uiDocument: "src/app/ui/index.html",
    uiStyles: "src/app/ui/styles.css",
  },

  operations: {
    getScores: operation(validators.getScores, handlers.getScores),
    submitScore: operation(validators.submitScore, handlers.submitScore),
  },
};
```

**Dual-CSP invariant:** `index.html` uses `script-src 'self'; style-src 'self'`
(dev, separate files); `app.config.ts` uses `'unsafe-inline'` (release, inlined).
Change one without the other and it works in `bun run dev` but breaks on the
built executable.

---

## Phase 4 — Run

```sh
bun run dev
```

A native window opens with the game. Check: cards flip and match, score updates,
top-5 list loads, and a submitted score survives closing and reopening the window
(the host wrote `~/.brainflip/scores.txt`).

```sh
bunx tsc --noEmit   # now passes
```

---

## Phase 5 — Tests

- `bun test` runs the kit tests plus anything you add. Add `src/app` tests for
  the score logic and the validators — no WebView needed, call the handlers and
  validators directly.
- The existing Playwright specs (`tests/card-matching.spec.ts`,
  `tests/example.spec.ts`) drive a browser against `localhost` and do not apply
  to a WebView application. Keep them under `test:e2e` against the legacy Express
  server during cutover, then delete.

---

## Phase 6 — Standalone executable

```sh
bun run build --output=brainflip --target=linux-x64     # or macos-arm64, on that OS
./dist/brainflip-linux-x64
```

Copy the binary into an empty directory and run it there to confirm it needs no
adjacent files. It embeds Bun, the host, and the bundled UI; `~/.brainflip/` is
created on first score submission.

---

## Phase 7 — Retire the old backends

After parity is confirmed:

- **Flask:** delete `main.py`, `pyproject.toml`, `uv.lock`, `.python-version`.
- **Express:** delete `server/`, `public/` (its assets are now embedded), remove
  `express` and `nodemon`, drop `start:express` / `dev:express`.
- Update `README.md` to the Crumb workflow (`bun run dev`, `bun run build`).
- `docs/` staged by the extract is Crumb's own build-and-ship guide — keep it or
  move it under a `crumb/` subfolder; it is not Brainflip documentation.

---

## Decisions you must make

1. **Tailwind:** compiled static CSS (smaller, adds a build step) vs. vendored
   full build (larger, no build step).
2. **Scores file location:** `~/.brainflip/scores.txt` as above, or an
   XDG/`Application Support` path. Handle missing file and denied writes.
3. **Debug mode:** the `?debug=true` mechanism is gone — replace with a shortcut
   or a build flag.
4. **Cutover:** how long to keep the Express server runnable in parallel.

## What would have made this *not* feasible

For contrast — Crumb would be the wrong target if Brainflip instead:

- served a shared leaderboard to multiple players (needs a real server),
- authenticated users or held an API key that cannot ship to the client,
- required Windows, or
- depended on a heavy SSR framework whose output cannot bundle without a runtime.

None of those apply. Brainflip's backend exists only to persist a local text
file, which is exactly what a Crumb host operation is for.
