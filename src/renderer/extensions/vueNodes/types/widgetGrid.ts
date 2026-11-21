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

/**
 * Data a widget row needs to render in {@link WidgetGrid}. Required fields cover
 * the static preview path; the optional interactive fields are supplied only by
 * the store-backed {@link ProcessedWidget} superset.
 */
export interface WidgetGridItem {
  renderKey: string
  name: string
  type: string
  value: WidgetValue
  label?: string
  disabled?: boolean
  spec?: InputSpecV2
  visible: boolean
  displayLabel?: string
  vueComponent?: Component
  inputRole?: 'socket' | 'autogrowGroup'
  handleContextMenu?: (e: PointerEvent) => void
  hasError?: boolean
  readonly sizing?: WidgetSizing
  slotMetadata?: WidgetSlotMetadata
  /**
   * The widget's input is satisfied by an upstream link; the row renders
   * socket-only (no control) instead of disappearing entirely.
   */
  suppressedByConnection?: boolean
  tooltipText?: string
  updateHandler?: (value: WidgetValue) => void
  widgetId?: WidgetId
}
