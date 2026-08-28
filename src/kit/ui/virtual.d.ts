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
