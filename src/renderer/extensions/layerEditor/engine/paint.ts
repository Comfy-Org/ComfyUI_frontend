import type { ContentStore } from './content'
import type { Command } from './history'
import type { DrawableData, Rect, Vec2 } from './node'

export interface CoordSample {
  x: number
  y: number
  pressure: number
  tiltX?: number
  tiltY?: number
  velocity?: number
  time: number
}

export interface Dynamics {
  size?: boolean
  opacity?: boolean
  hardness?: boolean
  angle?: boolean
}

export type SymmetryMode =
  | 'none'
  | 'mirror-h'
  | 'mirror-v'
  | 'mirror-both'
  | 'mandala'

export interface SymmetrySpec {
  mode: SymmetryMode
  sectors?: number
  cx: number
  cy: number
}

export interface BrushParams {
  size: number
  hardness: number
  spacing: number
  opacity: number
  flow: number
  color: string
  bgColor?: string
  dynamics?: Dynamics
  symmetry?: SymmetrySpec
}

export interface PaintTarget {
  drawable: DrawableData
  channel: 'content' | 'mask'
  bitmap: HTMLCanvasElement
  slot: { contentId: string; url?: string }
  content: ContentStore
  toLocal(pt: Vec2): Vec2
  toDocRect?(r: { x0: number; y0: number; x1: number; y1: number }): Rect
  selection?: Float32Array | null
  lockAlpha?: boolean

  scale: number
}

export interface PaintCore {
  start(target: PaintTarget, params: BrushParams, first: CoordSample): void
  motion(sample: CoordSample): void

  finish(): Command | null
  cancel(): void

  preview(): HTMLCanvasElement | null
  previewDocRects?(): Rect[] | null
  tick?(): void
  modifierPress?(pt: Vec2): boolean
}

export interface PaintCoreDef {
  id: string
  create(): PaintCore
}

const registry = new Map<string, PaintCoreDef>()

export function registerPaintCore(def: PaintCoreDef): void {
  registry.set(def.id, def)
}

export function getPaintCore(id: string): PaintCoreDef {
  const def = registry.get(id)
  if (!def) throw new Error(`Unknown paint core: ${id}`)
  return def
}
