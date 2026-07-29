import type { TooltipOptions } from 'primevue'
import type { Component } from 'vue'

import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  type: string
}

/**
 * Data a widget row needs to render in {@link WidgetGrid}. Required fields cover
 * the static preview path; the optional interactive fields are supplied only by
 * the store-backed {@link ProcessedWidget} superset.
 */
export interface WidgetGridItem {
  simplified: SimplifiedWidget
  vueComponent: Component
  visible: boolean
  renderKey: string
  hasLayoutSize?: boolean
  hasError?: boolean
  widgetId?: WidgetId
  slotMetadata?: WidgetSlotMetadata
  tooltipConfig?: TooltipOptions
  updateHandler?: (value: WidgetValue) => void
  handleContextMenu?: (e: PointerEvent) => void
}
