import type { CompositorWidgetValue } from '@comfyorg/graph-model/compositor'
export type { CompositorWidgetValue } from '@comfyorg/graph-model/compositor'

export function emptyCompositorWidgetValue(): CompositorWidgetValue {
  return {}
}

export function isCompositorWidgetValue(
  value: unknown
): value is CompositorWidgetValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
