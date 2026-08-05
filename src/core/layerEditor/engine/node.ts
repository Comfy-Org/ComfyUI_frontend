import type { FillSpec } from './fill'
import type { LayerMode } from './mode'
import type { LayerFxData } from './render/layerFx'
import type { FillStyle, PathData, StrokeStyle } from './vector'

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Transform {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface Locks {
  content: boolean
  position: boolean
  visibility: boolean
}

export interface NodeBase {
  id: string
  kind: string
  name: string
  visible: boolean
  opacity: number
  mode: LayerMode
  transform: Transform
  locks: Locks
  colorTag?: string
  fx?: LayerFxData[]
}

export type ChannelRole = 'mask' | 'selection' | 'saved'

export interface ChannelData {
  id: string
  role: ChannelRole
  contentId: string
  url?: string
  enabled: boolean
  color?: string
  bounds?: Rect
}

export interface EffectRef {
  id: string
  op: string
  enabled: boolean
  params: Record<string, unknown>
}

export interface DrawableData extends NodeBase {
  mask?: ChannelData
  effects?: EffectRef[]
}

export interface RasterData extends DrawableData {
  kind: 'raster'
  contentId: string
  url?: string
  naturalWidth: number
  naturalHeight: number
  lockAlpha?: boolean
}

export type FontRef =
  | { kind: 'builtin'; id: string }
  | { kind: 'url'; url: string; name?: string }

export interface TextData extends DrawableData {
  kind: 'text'
  text: string
  fontRef: FontRef
  fontSize: number
  color: string
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

export interface VectorData extends DrawableData {
  kind: 'vector'

  path: PathData
  fill?: FillStyle
  stroke?: StrokeStyle
}

export interface GroupData extends DrawableData {
  kind: 'group'
  children: SceneNode[]
  passThrough: boolean
}

export interface AdjustmentData extends DrawableData {
  kind: 'adjustment'
  op: string
  params: Record<string, number>
  curves?: { master?: string; red?: string; green?: string; blue?: string }
}

export interface FillData extends DrawableData {
  kind: 'fill'
  fill: FillSpec
}

export type SceneNode =
  | RasterData
  | TextData
  | VectorData
  | GroupData
  | AdjustmentData
  | FillData

export function isDrawable(node: NodeBase): node is DrawableData {
  return node.kind !== 'path'
}

export function isGroup(node: NodeBase): node is GroupData {
  return node.kind === 'group'
}
