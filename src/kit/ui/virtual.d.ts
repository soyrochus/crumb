declare module "app:selection" {
  /** Name of the application chosen at build time. */
  const name: string;
  export default name;
}

declare module "app:ui" {
  const html: string;
  export default html;
}

declare module "app:native" {
  import type { NativeWindow as NativeWindowInstance, WindowOptions } from "@nativewindow/webview";

  export default function getNativeBinding(): {
    NativeWindow: new (options?: WindowOptions) => NativeWindowInstance;
    loadHtmlOrigin(): string;
  };
}
