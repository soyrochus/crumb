export async function buildUiHtml(): Promise<string> {
  const result = await Bun.build({ entrypoints: ["src/ui/app.ts"], target: "browser", minify: true });
  if (!result.success || !result.outputs[0]) throw new AggregateError(result.logs, "UI build failed");
  const script = (await result.outputs[0].text()).replaceAll("</script", "<\\/script");
  const style = await Bun.file("src/ui/styles.css").text();
  const template = await Bun.file("src/ui/index.html").text();
  return template
    .replace('<link rel="stylesheet" href="./styles.css">', `<style>${style}</style>`)
    .replace('<script type="module" src="./app.ts"></script>', `<script>${script}</script>`)
    .replace("script-src 'self'", "script-src 'unsafe-inline'")
    .replace("style-src 'self'", "style-src 'unsafe-inline'");
}
