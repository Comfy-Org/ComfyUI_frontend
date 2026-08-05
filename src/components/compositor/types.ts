import type { CompositorLayerState } from '@/composables/compositor/compositorLayerState'

export type CompositorWidgetValue = Partial<CompositorLayerState>

export function emptyCompositorWidgetValue(): CompositorWidgetValue {
  return {}
}

export function isCompositorWidgetValue(
  value: unknown
): value is CompositorWidgetValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
