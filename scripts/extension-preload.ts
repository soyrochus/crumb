/**
 * Bun runtime plugins must be present before the runner's dependency graph is
 * evaluated. This preload resolves stable app:ext/<name> imports to a lazy
 * proxy; runner.ts fills the verified artifact map before the host starts.
 */
import { plugin, type BunPlugin } from "bun";

const extensionPreload: BunPlugin = {
  name: "app-extension-preload",
  setup(build) {
    build.onResolve({ filter: /^app:ext\/[a-z][a-z0-9_-]*$/ }, ({ path }) => ({
      path: `ext/${path.slice("app:ext/".length)}`,
      namespace: "app",
    }));
    build.onLoad({ filter: /^ext\/[a-z][a-z0-9_-]*$/, namespace: "app" }, ({ path }) => {
      const name = path.slice("ext/".length);
      return {
        contents: `
          export default new Proxy({}, {
            get(_target, property) {
              const extensions = globalThis[Symbol.for("app.nativeExtensions")];
              const artifact = extensions?.get(${JSON.stringify(name)});
              if (!artifact) throw new Error(${JSON.stringify(`Native extension "${name}" is not declared, verified, and ready`)});
              return require(artifact)[property];
            }
          });
        `,
        loader: "js",
      };
    });
  },
};

plugin(extensionPreload);
