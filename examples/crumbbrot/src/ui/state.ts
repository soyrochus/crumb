import type { RenderFractalInput, RenderFractalOutput } from "../shared/contracts";

export interface Viewport {
  centerX: number;
  centerY: number;
  scale: number;
}

export const DEFAULT_VIEWPORT: Viewport = { centerX: -0.5, centerY: 0, scale: 3.5 };

export function canvasPointToComplex(
  viewport: Viewport,
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
): { real: number; imaginary: number } {
  return {
    real: viewport.centerX + (pixelX - width / 2) * viewport.scale / width,
    imaginary: viewport.centerY + (pixelY - height / 2) * viewport.scale / width,
  };
}

export function zoomViewport(
  viewport: Viewport,
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
  factor: number,
): Viewport {
  const before = canvasPointToComplex(viewport, pixelX, pixelY, width, height);
  const scale = Math.min(8, Math.max(1e-14, viewport.scale * factor));
  const scaled = { ...viewport, scale };
  const after = canvasPointToComplex(scaled, pixelX, pixelY, width, height);
  return {
    centerX: viewport.centerX + before.real - after.real,
    centerY: viewport.centerY + before.imaginary - after.imaginary,
    scale,
  };
}

export function panViewport(viewport: Viewport, deltaX: number, deltaY: number, width: number): Viewport {
  return {
    ...viewport,
    centerX: viewport.centerX - deltaX * viewport.scale / width,
    centerY: viewport.centerY - deltaY * viewport.scale / width,
  };
}

export class RenderCoordinator {
  private generation = 0;
  private active = false;
  private queued: { generation: number; input: RenderFractalInput } | null = null;

  constructor(
    private readonly render: (input: RenderFractalInput) => Promise<RenderFractalOutput>,
    private readonly onFrame: (frame: RenderFractalOutput) => void,
    private readonly onState: (rendering: boolean, error: string | null) => void,
  ) {}

  request(input: RenderFractalInput): void {
    this.queued = { generation: ++this.generation, input };
    if (!this.active) void this.drain();
  }

  invalidate(): void {
    this.generation++;
    this.queued = null;
  }

  private async drain(): Promise<void> {
    this.active = true;
    this.onState(true, null);
    let lastError: string | null = null;
    while (this.queued) {
      const request = this.queued;
      this.queued = null;
      try {
        const frame = await this.render(request.input);
        if (request.generation === this.generation) this.onFrame(frame);
      } catch (error: unknown) {
        if (request.generation === this.generation) {
          lastError = error instanceof Error ? error.message : "The render failed.";
        }
      }
    }
    this.active = false;
    this.onState(false, lastError);
  }
}
