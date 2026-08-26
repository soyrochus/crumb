import { buildUiHtml } from "./ui-artifact";

await Bun.write("dist/ui.html", await buildUiHtml());
console.log("Built dist/ui.html");
