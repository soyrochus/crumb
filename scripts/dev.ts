import { plugin, type BunPlugin } from "bun";
import { buildUiHtml } from "./ui-artifact";

const html = await buildUiHtml();
const uiPlugin: BunPlugin = {
  name: "crumb-development-ui",
  setup(build) {
    build.onResolve({ filter: /^crumb:ui$/ }, () => ({ path: "crumb:ui", namespace: "crumb" }));
    build.onLoad({ filter: /.*/, namespace: "crumb" }, () => ({ contents: `export default ${JSON.stringify(html)}`, loader: "js" }));
  },
};
plugin(uiPlugin);
await import("../src/host/main");
