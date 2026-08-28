import { invoke } from "../../kit/ui/bridge";
import type { AppOperations } from "../shared/contracts";

const button = document.getElementById("ask") as HTMLButtonElement;
const result = document.getElementById("result") as HTMLElement;

button.addEventListener("click", () => {
  void invoke<AppOperations, "describeHost">("describeHost", {})
    .then((summary) => { result.textContent = JSON.stringify(summary, null, 2); })
    .catch((error: unknown) => { result.textContent = error instanceof Error ? error.message : "The host call failed."; });
});
