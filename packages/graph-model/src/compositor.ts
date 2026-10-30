import type { CompactSize } from '@comfyorg/shared-frontend-utils/geometry'
import type { BlendFn } from '@comfyorg/layer-editor/mode'
import type { Transform } from '@comfyorg/layer-editor/node'

export interface CompositorLayerEntry {
  name: string
  visible: boolean
  opacity: number
  blend: BlendFn
  transform: Transform
  flipH: boolean
  flipV: boolean
}

export interface CompositorBackgroundEntry {
  color: string
  opacity: number
  visible: boolean
}

export interface CompositorLayerState {
  version?: 1
  canvas?: CompactSize
  inputs?: string[]
  background?: CompositorBackgroundEntry
  order?: number[]
  layers: Array<CompositorLayerEntry | null>
}

export type CompositorWidgetValue = Partial<CompositorLayerState>
