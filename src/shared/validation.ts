import { isAbsolute, normalize } from "node:path";
import type { DomainError, RpcMethod } from "./contracts";

export class ValidationError extends Error {
  readonly code = "INVALID_INPUT" as const;
}

export function normalizeAbsolutePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !isAbsolute(value)) {
    throw new ValidationError("Expected a non-empty absolute path without NUL bytes");
  }
  return normalize(value);
}

function expectPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Expected an object");
  }
  return value as Record<string, unknown>;
}

function expectNoKeys(value: unknown): Record<string, never> {
  const object = expectPlainObject(value);
  if (Object.keys(object).length !== 0) throw new ValidationError("Expected no arguments");
  return {};
}

export function validateRpcInput(method: RpcMethod, value: unknown): unknown {
  if (method === "getPlatformInfo" || method === "getLocations") return expectNoKeys(value);
  const object = expectPlainObject(value);
  const path = normalizeAbsolutePath(object.path);
  if (method === "getPreview") {
    if (Object.keys(object).some((key) => key !== "path")) throw new ValidationError("Unexpected argument");
    return { path };
  }
  if (typeof object.showHidden !== "boolean") throw new ValidationError("showHidden must be boolean");
  if (Object.keys(object).some((key) => key !== "path" && key !== "showHidden")) {
    throw new ValidationError("Unexpected argument");
  }
  return { path, showHidden: object.showHidden };
}

const errorCodes: Record<string, DomainError["code"]> = {
  ENOENT: "NOT_FOUND",
  EACCES: "PERMISSION_DENIED",
  EPERM: "PERMISSION_DENIED",
  ENOTDIR: "NOT_DIRECTORY",
  ENODEV: "UNAVAILABLE",
  ESTALE: "UNAVAILABLE",
};

export function normalizeError(error: unknown): DomainError {
  if (error instanceof ValidationError) return { code: error.code, message: error.message };
  const code = error && typeof error === "object" && "code" in error
    ? errorCodes[String((error as { code?: unknown }).code)]
    : undefined;
  return {
    code: code ?? "UNAVAILABLE",
    message: code === "NOT_FOUND" ? "The item is no longer available."
      : code === "PERMISSION_DENIED" ? "Permission was denied."
      : code === "NOT_DIRECTORY" ? "The location is not a directory."
      : "The filesystem location is unavailable.",
  };
}
