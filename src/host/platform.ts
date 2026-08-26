import type { PlatformInfo, SupportedPlatform } from "../shared/contracts";
import { normalizeError } from "../shared/validation";

export class UnsupportedPlatformError extends Error {
  constructor(readonly platform: string) {
    super(`Crumb supports macOS and Linux; ${platform} is unsupported.`);
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
  return `Crumb could not start: ${normalizeError(error).message}`;
}
