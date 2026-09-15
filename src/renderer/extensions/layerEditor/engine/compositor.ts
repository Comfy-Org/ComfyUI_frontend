import type { EffectiveMode } from './mode'
import type { Rect } from './node'

export interface NodeTexture {
  source: WebGLTexture | HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  rect: Rect
  linear: boolean
  key?: string
  version?: number
  dirtyRects?: Rect[]
}

interface LayerInput {
  texture: NodeTexture
  mode: EffectiveMode
  opacity: number
  mask?: NodeTexture
}

interface AdjustmentInput {
  adjust: { op: number; params: number[]; lut?: Uint8Array }
  opacity: number
  mask?: NodeTexture
}

export type CompositeInput = LayerInput | AdjustmentInput

export interface CompositorInit {
  width: number
  height: number
  onContextRestored?: () => void
}

export interface Compositor {
  init(opts: CompositorInit): boolean
  beginFrame?(): void
  resize(width: number, height: number): void

  composite(
    inputs: CompositeInput[],
    target?: FBOHandle | null,
    region?: Rect
  ): void

  allocTarget(width: number, height: number): FBOHandle
  freeTarget(handle: FBOHandle): void

  targetTexture(handle: FBOHandle): WebGLTexture | null

  upload(
    source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas
  ): WebGLTexture

  readback(region?: Rect): ImageData
  toBlob(): Promise<Blob>
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null
  dispose(): void
}

export interface FBOHandle {
  readonly id: number
  readonly width: number
  readonly height: number
}
