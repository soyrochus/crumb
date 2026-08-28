export type ShutdownHandler = () => void | Promise<void>;

export interface ShutdownDiagnostic {
  name: string;
  error?: unknown;
  timedOut?: boolean;
}

export interface RunShutdownOptions {
  timeoutMs?: number;
  report?: (diagnostic: ShutdownDiagnostic) => void;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 3_000;

interface RegisteredHandler {
  name: string;
  handler: ShutdownHandler;
}

/**
 * Ordered, once-only shutdown work. A registry is exported as a class as well
 * as a process-wide instance so lifecycle behavior can be tested without
 * loading the native window binding.
 */
export class ShutdownRegistry {
  readonly #handlers: RegisteredHandler[] = [];
  #run: Promise<void> | null = null;

  register(name: string, handler: ShutdownHandler): () => void {
    if (this.#run) throw new Error(`Cannot register shutdown handler "${name}" after shutdown has started`);
    const registered = { name, handler };
    this.#handlers.push(registered);
    return () => {
      if (this.#run) return;
      const index = this.#handlers.indexOf(registered);
      if (index !== -1) this.#handlers.splice(index, 1);
    };
  }

  run(options: RunShutdownOptions = {}): Promise<void> {
    if (this.#run) return this.#run;
    this.#run = this.#runOnce(options);
    return this.#run;
  }

  async #runOnce(options: RunShutdownOptions): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    const report = options.report ?? reportShutdownDiagnostic;
    const deadline = Date.now() + timeoutMs;

    for (const { name, handler } of this.#handlers) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        report({ name, timedOut: true });
        return;
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const completion = Promise.resolve()
        .then(handler)
        .then(
          () => "complete" as const,
          (error: unknown) => ({ error }) as const,
        );
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), remaining);
      });
      const result = await Promise.race([completion, timeout]);
      if (timer) clearTimeout(timer);

      if (result === "timeout") {
        report({ name, timedOut: true });
        return;
      }
      if (result !== "complete") report({ name, error: result.error });
    }
  }
}

export function reportShutdownDiagnostic(diagnostic: ShutdownDiagnostic): void {
  if (diagnostic.timedOut) {
    console.error(`Shutdown handler "${diagnostic.name}" did not finish within the shutdown timeout; exiting anyway.`);
    return;
  }
  const detail = diagnostic.error instanceof Error ? `: ${diagnostic.error.message}` : "";
  console.error(`Shutdown handler "${diagnostic.name}" failed${detail}; continuing shutdown.`);
}

const applicationShutdown = new ShutdownRegistry();

/** Register application or extension cleanup to run when the window closes. */
export function registerShutdownHandler(name: string, handler: ShutdownHandler): () => void {
  return applicationShutdown.register(name, handler);
}

export async function shutdownAndExit(
  registry: ShutdownRegistry = applicationShutdown,
  exit: (code: number) => void = (code) => process.exit(code),
  options: RunShutdownOptions = {},
): Promise<void> {
  await registry.run(options);
  exit(0);
}
