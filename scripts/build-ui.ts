import { buildUiHtml } from "./ui-artifact";
import { registry } from "../app.config";
import { resolveApplication, MissingApplicationNameError, selectedApplicationName } from "../src/kit/shared/config";

const selected = selectedApplicationName(Bun.argv);
const application = resolveApplication(registry, selected);
await Bun.write("dist/ui.html", await buildUiHtml(application));
console.log(`Built dist/ui.html for ${application.name}`);
