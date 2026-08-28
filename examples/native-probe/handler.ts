import probe from "app:ext/probe";

export function describeNativeHost(platform: string): Record<string, unknown> {
  const answer = probe.answer;
  if (typeof answer !== "function") throw new Error('Native extension "probe" does not export answer()');
  return {
    platform,
    bunVersion: Bun.version,
    startedAt: new Date().toISOString(),
    nativeProbeAnswer: answer(),
  };
}
