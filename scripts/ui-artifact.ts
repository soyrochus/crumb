import type { ApplicationConfig } from "../src/kit/shared/config";

export async function buildUiHtml(application: ApplicationConfig): Promise<string> {
  const result = await Bun.build({ entrypoints: [application.entries.uiScript], target: "browser", minify: true });
  if (!result.success || !result.outputs[0]) throw new AggregateError(result.logs, "UI build failed");
  const script = (await result.outputs[0].text()).replaceAll("</script", "<\\/script");
  const style = await Bun.file(application.entries.uiStyles).text();
  const template = await Bun.file(application.entries.uiDocument).text();
  return template
    .replace('<link rel="stylesheet" href="./styles.css">', `<style>${style}</style>`)
    .replace('<script type="module" src="./app.ts"></script>', `<script>${script}</script>`)
    .replace("script-src 'self'", "script-src 'unsafe-inline'")
    .replace("style-src 'self'", "style-src 'unsafe-inline'");
}
