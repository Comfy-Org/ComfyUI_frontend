import type { INodeInputSlot, Point } from '@/lib/litegraph/src/interfaces'
import type {
  CanvasPointerEvent,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeId } from '@/types/nodeId'

import { resolveConcretePromotedWidget } from './resolveConcretePromotedWidget'
import { resolveSubgraphInputTarget } from './resolveSubgraphInputTarget'

/**
 * Where a promoted subgraph input is sourced from inside the subgraph. The
 * interior node id + widget name that the host input slot forwards to. Resolved
 * by walking the live link, so it is authoritative derived data — never stored
 * on the projected widget.
 */
export interface PromotedSource {
  nodeId: NodeId
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
 * Forwards a promoted widget's value change to the interior source widget's
 * callback. The store-backed projected widget only carries the value in
 * {@link useWidgetValueStore}, so without this the interior widget.callback
 * set by custom node extensions never fires when the host edits the promoted
 * value — this is the bridge that keeps that contract intact.
 *
 * The host {@link useWidgetValueStore} entry stays the sole authoritative
 * value (ADR-SUBGRAPH-PROMOTION-0009). `sourceWidget` is resolved by
 * definition, not by host instance — every host of a shared subgraph
 * definition resolves to the same interior widget object — so writing to it
 * must not outlive this call, or a host's edit leaks into every sibling host
 * of that definition. The value is written immediately before invoking the
 * callback, mirroring the write-then-invoke order of
 * {@link BaseWidget.setValue} so first-party
 * callbacks that ignore their callback args and read their captured widget's
 * own `.value` (e.g. `useImageUploadWidget`) observe the fresh value, then
 * restored to its prior value once the callback returns.
 */
export function invokePromotedWidgetSourceCallback(
  node: LGraphNode,
  input: INodeInputSlot,
  value: TWidgetValue,
  canvas?: LGraphCanvas,
  pos?: Point,
  e?: CanvasPointerEvent
): void {
  const source = promotedInputSource(node, input)
  if (!source) return

  const resolution = resolveConcretePromotedWidget(
    node,
    source.nodeId,
    source.widgetName
  )
  if (resolution.status !== 'resolved') return

  const { node: sourceNode, widget: sourceWidget } = resolution.resolved
  const priorValue = sourceWidget.value
  sourceWidget.value = value
  try {
    sourceWidget.callback?.(value, canvas, sourceNode, pos, e)
  } finally {
    sourceWidget.value = priorValue
  }
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
export function promotedInputWidget(
  node: LGraphNode,
  input: INodeInputSlot
): IBaseWidget | null {
  const id = input.widgetId
  if (!id) return null
  const store = useWidgetValueStore()
  return {
    get name() {
      return store.getWidget(id)?.name ?? input.name
    },
    get label() {
      return store.getWidget(id)?.label ?? input.label ?? input.name
    },
    set label(next) {
      const state = store.getWidget(id)
      if (state) state.label = next
    },
    get y() {
      return store.getWidget(id)?.y ?? 0
    },
    set y(next) {
      const state = store.getWidget(id)
      if (state) state.y = next
    },
    widgetId: id,
    get type() {
      return store.getWidget(id)?.type ?? 'text'
    },
    get options() {
      return store.getWidget(id)?.options ?? {}
    },
    get value() {
      return store.getWidget(id)?.value
    },
    set value(next) {
      store.setValue(id, next)
    },
    // Canvas edits operate on a transient concrete widget (toConcreteWidget),
    // so the value setter above is never invoked; BaseWidget.setValue writes its
    // own local state and then calls this callback, which is the only bridge
    // back to the store.
    callback(next, canvas, _node, pos, e) {
      store.setValue(id, next)
      invokePromotedWidgetSourceCallback(node, input, next, canvas, pos, e)
    }
  }
}

export function promotedInputWidgets(node: LGraphNode): IBaseWidget[] {
  return node.inputs.flatMap((input) => {
    const widget = promotedInputWidget(node, input)
    return widget ? [widget] : []
  })
}
