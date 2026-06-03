import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { resolveSubgraphInputTarget } from './resolveSubgraphInputTarget'

/**
 * Where a promoted subgraph input is sourced from inside the subgraph. The
 * interior node id + widget name that the host input slot forwards to. Resolved
 * by walking the live link, so it is authoritative derived data — never stored
 * on the projected widget.
 */
export interface PromotedSource {
  nodeId: string
  widgetName: string
}

/**
 * The interior source of a host input slot, or undefined when the slot is not a
 * promoted widget input.
 */
export function promotedInputSource(
  node: LGraphNode,
  input: INodeInputSlot
): PromotedSource | undefined {
  if (!input.widgetId) return undefined
  return resolveSubgraphInputTarget(node, input.name)
}

/** The host input slot backing a projected widget, matched by widgetId. */
export function inputForWidget(
  node: LGraphNode,
  widget: IBaseWidget
): INodeInputSlot | undefined {
  return node.getSlotFromWidget(widget)
}

/**
 * The interior source of a widget when it is a promoted subgraph input.
 * Replaces ad-hoc "is this promoted?" duck-typing: a widget is promoted iff its
 * host node is a subgraph node and its backing input slot has an interior
 * source.
 */
export function widgetPromotedSource(
  node: LGraphNode,
  widget: IBaseWidget
): PromotedSource | undefined {
  if (!node.isSubgraphNode()) return undefined
  const input = inputForWidget(node, widget)
  if (!input) return undefined
  return promotedInputSource(node, input)
}

/**
 * Projects a promoted subgraph input into an ordinary widget descriptor. The
 * descriptor is store-backed: type/value/options read live from
 * {@link useWidgetValueStore} by widgetId (mirroring BaseWidget), so the row
 * list does not reactively rebuild — and re-key — on every value edit.
 *
 * `name` is the input slot name (unique + fixed; widgetId derives from it), and
 * `label` is the mutable display label. Returns null when the input is not a
 * promoted widget input.
 */
export function promotedInputWidget(input: INodeInputSlot): IBaseWidget | null {
  const id = input.widgetId
  if (!id) return null
  const store = useWidgetValueStore()
  return {
    name: input.name,
    label: input.label ?? input.name,
    y: 0,
    widgetId: id,
    get type() {
      return store.getWidget(id)?.type ?? 'text'
    },
    get options() {
      return store.getWidget(id)?.options ?? {}
    },
    get value() {
      const value = store.getWidget(id)?.value
      return isWidgetValue(value) ? value : undefined
    },
    set value(next) {
      store.setValue(id, next)
    }
  }
}

/** Every promoted subgraph input on a node, projected to ordinary widgets. */
export function promotedInputWidgets(node: LGraphNode): IBaseWidget[] {
  return node.inputs.flatMap((input) => {
    const widget = promotedInputWidget(input)
    return widget ? [widget] : []
  })
}
