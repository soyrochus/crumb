export type DomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "NOT_DIRECTORY"
  | "UNAVAILABLE"
  | "UNSUPPORTED_PLATFORM";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

/**
 * The shape an application's declared operations must follow. Each entry names
 * the input the page sends and the output the host returns. The kit is generic
 * over this map and knows no operation name.
 */
export interface OperationShape {
  input: unknown;
  output: unknown;
}

export type OperationMap = Record<string, OperationShape>;

/**
 * One declared operation: a validator that turns untrusted input into a checked
 * value, and the handler that acts on it. Types are erased at the table
 * boundary so a heterogeneous map stays assignable; `operation()` restores them
 * at the point of declaration.
 */
export interface Operation {
  validate(raw: unknown): unknown;
  handle(input: unknown): unknown | Promise<unknown>;
}

export type Operations = Record<string, Operation>;

export function operation<Input, Output>(
  validate: (raw: unknown) => Input,
  handle: (input: Input) => Output | Promise<Output>,
): Operation {
  return { validate, handle: (input) => handle(input as Input) };
}
