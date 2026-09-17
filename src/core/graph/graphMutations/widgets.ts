import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'

import { isRecord } from './prepare'
import type { PreparedWidgetEntry, SemanticNodePayload } from './types'

/**
 * `ISerialisedNode.widgets_values` is declared as an array, but some custom
 * nodes override it with a record (see its docs) and op-layer payloads carry
 * values keyed by widget name. These two accessors are the only place the
 * wider shape crosses that boundary; everything else narrows normally.
 */
export type StoredWidgetValues = WidgetValue[] | Record<string, WidgetValue>
export function storedWidgetValues(
  serialised: ISerialisedNode | undefined
): StoredWidgetValues | undefined {
  return serialised?.widgets_values
}
export function setStoredWidgetValues(
  serialised: ISerialisedNode,
  values: StoredWidgetValues | undefined
): void {
  serialised.widgets_values = values as ISerialisedNode['widgets_values']
}
export function widgetType(value: unknown): string {
  switch (typeof value) {
    case 'boolean':
      return 'boolean'
    case 'number':
      return 'number'
    case 'string':
      return 'string'
    default:
      return 'legacy'
  }
}
export function widgetEntries(
  payload: SemanticNodePayload
): PreparedWidgetEntry[] {
  const values = payload.widgets_values
  if (Array.isArray(values)) {
    return values.map((value, index) => ({
      name: String(index),
      value: structuredClone(value) as WidgetValue,
      type: widgetType(value)
    }))
  }
  if (!isRecord(values)) return []
  return Object.entries(values).map(([name, value]) => ({
    name,
    value: structuredClone(value) as WidgetValue,
    type: widgetType(value)
  }))
}
/**
 * Snapshots are derived state: record-shaped values and the named record are
 * updated by name, while a positional array is left as saved because nothing
 * here can prove which slot a name owns.
 */
export function syncSerializedWidgetValue(
  state: NodeState,
  name: string,
  value: unknown
): void {
  const serialised = state.lastSerialization
  if (!serialised) return
  const values = storedWidgetValues(serialised)
  const named = serialised.widgets_values_named
  const clone = structuredClone(value) as WidgetValue
  if (isRecord(values)) values[name] = clone
  if (isRecord(named)) named[name] = clone
}
