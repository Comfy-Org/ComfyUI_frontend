import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { WidgetValue } from '@/types/simplifiedWidget'

/**
 * The `widgets_values` of a doc node entry. cmp stores catalog nodes by
 * widget name and frontend-only nodes positionally; a serialized node that
 * declares no widgets omits the key altogether.
 */
export type WidgetValuePayload =
  | { kind: 'omitted' }
  | { kind: 'positional'; values: readonly WidgetValue[] }
  | { kind: 'named'; values: ReadonlyMap<string, WidgetValue> }

export interface PlaceholderWidget {
  name: string
  value: WidgetValue
  type: string
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

export function cloneWidgetValue(value: unknown): WidgetValue {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
      return value
    case 'object':
      return structuredClone(value)
    default:
      return null
  }
}

export function parseWidgetValues(value: unknown): WidgetValuePayload {
  if (Array.isArray(value)) {
    return { kind: 'positional', values: value.map(cloneWidgetValue) }
  }
  if (typeof value === 'object' && value !== null) {
    return {
      kind: 'named',
      values: new Map(
        Object.entries(value).map(([name, entry]) => [
          name,
          cloneWidgetValue(entry)
        ])
      )
    }
  }
  return { kind: 'omitted' }
}

/**
 * The serialised slots `LGraphNode.configure()` reads for a payload.
 *
 * `configure()` treats `widgets_values` as positional and reads name-keyed
 * values only from `widgets_values_named`. Named payloads therefore use the
 * separate named slot; callers may retain the original record for extension
 * hooks.
 *
 * Values are handed over as-is: {@link parseWidgetValues} is the single
 * detachment boundary, so a `WidgetValuePayload` never aliases the wire
 * payload and re-cloning here would only repeat that work.
 */
export function serialisedWidgetSlots(
  widgets: WidgetValuePayload
): Pick<ISerialisedNode, 'widgets_values' | 'widgets_values_named'> {
  switch (widgets.kind) {
    case 'omitted':
      return {}
    case 'positional':
      return { widgets_values: [...widgets.values] }
    case 'named':
      return { widgets_values_named: Object.fromEntries(widgets.values) }
  }
}

/** Store records for a node no live widget has registered yet. */
export function placeholderWidgets(
  widgets: WidgetValuePayload
): readonly PlaceholderWidget[] {
  switch (widgets.kind) {
    case 'omitted':
      return []
    case 'positional':
      return widgets.values.map((value, index) => ({
        name: String(index),
        value,
        type: widgetType(value)
      }))
    case 'named':
      return [...widgets.values].map(([name, value]) => ({
        name,
        value,
        type: widgetType(value)
      }))
  }
}

/** The recorded title, else the registered display name, else the type. */
export function nodeTitle(title: unknown, type: string): string {
  const registered = Object.hasOwn(LiteGraph.registered_node_types, type)
    ? LiteGraph.registered_node_types[type].title
    : undefined
  return (typeof title === 'string' && title) || registered || type
}
