import type { FillSpec } from './fill'
import type { LayerMode } from './mode'

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

interface Locks {
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
}

type ChannelRole = 'mask' | 'selection' | 'saved'

export interface ChannelData {
  id: string
  role: ChannelRole
  contentId: string
  url?: string
  enabled: boolean
  color?: string
  bounds?: Rect
}

export interface DrawableData extends NodeBase {
  mask?: ChannelData
}

export interface RasterData extends DrawableData {
  kind: 'raster'
  contentId: string
  url?: string
  naturalWidth: number
  naturalHeight: number
  lockAlpha?: boolean
}

export interface GroupData extends DrawableData {
  kind: 'group'
  children: SceneNode[]
  passThrough: boolean
}

export interface FillData extends DrawableData {
  kind: 'fill'
  fill: FillSpec
}

export type SceneNode = RasterData | GroupData | FillData

export function isDrawable(node: NodeBase): node is DrawableData {
  return node.kind !== 'path'
}

export function isGroup(node: NodeBase): node is GroupData {
  return node.kind === 'group'
}
