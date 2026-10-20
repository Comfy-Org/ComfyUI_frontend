import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

export function cloneWidgetValue(value: TWidgetValue): TWidgetValue
export function cloneWidgetValue(value: unknown): unknown
export function cloneWidgetValue(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value ?? null
  return JSON.parse(JSON.stringify(value))
}

export function cloneWidgetValueTwice(
  value: TWidgetValue
): [TWidgetValue, TWidgetValue] {
  if (value == null || typeof value !== 'object') {
    const primitive = value ?? null
    return [primitive, primitive]
  }
  const json = JSON.stringify(value)
  return [JSON.parse(json), JSON.parse(json)]
}
