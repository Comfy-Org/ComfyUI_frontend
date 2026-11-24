import type { Component } from 'vue'

import type { RenderShape } from '@comfyorg/graph-model/globalEnums'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetSizing } from '@comfyorg/graph-model/widgets'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  promoted: boolean
  shape?: RenderShape
  type: string
}

export interface WidgetGridItem {
  renderKey: string
  name: string
  type: string
  value: WidgetValue
  label?: string
  disabled?: boolean
  spec?: InputSpecV2
  visible: boolean
  vueComponent?: Component
  inputRole?: 'socket' | 'autogrowGroup'
  handleContextMenu?: (e: PointerEvent) => void
  hasError?: boolean
  readonly sizing?: WidgetSizing
  slotMetadata?: WidgetSlotMetadata
  suppressedByConnection?: boolean
  tooltipText?: string
  updateHandler?: (value: WidgetValue) => void
  widgetId?: WidgetId
}
