import type { CompositorLayerState } from '@comfyorg/layer-editor/persistence/compositorTypes'

export type {
  CompositorBackgroundEntry,
  CompositorLayerEntry,
  CompositorLayerState
} from '@comfyorg/layer-editor/persistence/compositorTypes'

export type CompositorWidgetValue = Partial<CompositorLayerState>
