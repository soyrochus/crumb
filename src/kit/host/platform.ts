import { normalizeError } from "../shared/validation";

export type SupportedPlatform = "macos" | "linux";
export type PrimaryModifier = "Meta" | "Control";

export interface PlatformInfo {
  platform: SupportedPlatform;
  primaryModifier: PrimaryModifier;
}

export class UnsupportedPlatformError extends Error {
  constructor(readonly platform: string) {
    super(`This application supports macOS and Linux; ${platform} is unsupported.`);
  }
}

export class StartupConfigurationError extends Error {}

export function detectPlatform(platform = process.platform): SupportedPlatform {
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  throw new UnsupportedPlatformError(platform);
}

export function getPlatformInfo(platform = process.platform): PlatformInfo {
  const supported = detectPlatform(platform);
  return { platform: supported, primaryModifier: supported === "macos" ? "Meta" : "Control" };
}

export function startupErrorMessage(error: unknown): string {
  if (error instanceof UnsupportedPlatformError || error instanceof StartupConfigurationError) return error.message;
  return `The application could not start: ${normalizeError(error).message}`;
}
