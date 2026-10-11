import type { Component } from 'vue'

import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  promoted: boolean
  type: string
}

/**
 * Data a widget row needs to render in {@link WidgetGrid}. Required fields cover
 * the static preview path; the optional interactive fields are supplied only by
 * the store-backed {@link ProcessedWidget} superset.
 */
export interface WidgetGridItem {
  renderKey: string
  simplified: SimplifiedWidget
  visible: boolean
  vueComponent: Component
  handleContextMenu?: (e: PointerEvent) => void
  hasError?: boolean
  hasLayoutSize?: boolean
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
