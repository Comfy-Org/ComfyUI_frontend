import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { Point } from '@/lib/litegraph/src/interfaces'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

export interface PromotedWidgetView extends IBaseWidget {
  readonly node: SubgraphNode
  readonly sourceNodeId: string
  readonly sourceWidgetName: string
}

function resolve(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): { node: LGraphNode; widget: IBaseWidget } | undefined {
  const node = subgraphNode.subgraph.getNodeById(nodeId)
  if (!node) return undefined
  const widget = node.widgets?.find((w: IBaseWidget) => w.name === widgetName)
  return widget ? { node, widget } : undefined
}

export function createPromotedWidgetView(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string,
  displayName?: string
): PromotedWidgetView {
  const bareNodeId = stripGraphPrefix(nodeId as NodeId)

  const view = {} as PromotedWidgetView

  // Identity — own data properties
  Object.defineProperties(view, {
    sourceNodeId: { value: nodeId, enumerable: true },
    sourceWidgetName: { value: widgetName, enumerable: true }
  })

  // Positional — writable, owned by this view for _arrangeWidgets.
  // The y setter also syncs the DOM position override so DomWidgets.vue
  // positions the widget correctly even in Vue nodes mode (where draw()
  // is never called).
  let _y = 0
  Object.defineProperty(view, 'y', {
    get: () => _y,
    set: (v: number) => {
      _y = v
      syncDomOverride(subgraphNode, nodeId, widgetName, view)
    },
    enumerable: true,
    configurable: true
  })
  view.last_y = undefined
  view.computedHeight = undefined

  // Fixed properties
  Object.defineProperties(view, {
    node: {
      get: () => subgraphNode,
      enumerable: true
    },
    name: {
      get: () => displayName ?? widgetName,
      enumerable: true
    },
    serialize: { value: false, enumerable: true },
    computedDisabled: {
      get: () => false,
      set: () => {},
      enumerable: true
    }
  })

  // Delegated getters → interior widget
  Object.defineProperties(view, {
    type: {
      get: () =>
        resolve(subgraphNode, nodeId, widgetName)?.widget.type ?? 'button',
      enumerable: true
    },
    options: {
      get: () =>
        resolve(subgraphNode, nodeId, widgetName)?.widget.options ?? {},
      enumerable: true
    },
    tooltip: {
      get: () => resolve(subgraphNode, nodeId, widgetName)?.widget.tooltip,
      enumerable: true
    }
  })

  // Store-backed: value, label, hidden
  Object.defineProperties(view, {
    value: {
      get: () => {
        const state = useWidgetValueStore().getWidget(bareNodeId, widgetName)
        return state?.value
      },
      set: (v: unknown) => {
        const state = useWidgetValueStore().getWidget(bareNodeId, widgetName)
        if (state) state.value = v
      },
      enumerable: true
    },
    label: {
      get: () => {
        const state = useWidgetValueStore().getWidget(bareNodeId, widgetName)
        return state?.label ?? displayName ?? widgetName
      },
      set: (v: string | undefined) => {
        const state = useWidgetValueStore().getWidget(bareNodeId, widgetName)
        if (state) state.label = v
      },
      enumerable: true
    },
    hidden: {
      get: () => {
        const resolved = resolve(subgraphNode, nodeId, widgetName)
        return resolved?.widget.hidden ?? false
      },
      enumerable: true
    }
  })

  // Drawing — delegates to interior widget's concrete class
  view.draw = function (
    ctx: CanvasRenderingContext2D,
    _node: LGraphNode,
    widget_width: number,
    y: number,
    H: number,
    lowQuality?: boolean
  ) {
    const resolved = resolve(subgraphNode, nodeId, widgetName)
    if (!resolved) {
      drawDisconnectedPlaceholder(ctx, widget_width, y, H)
      return
    }

    if (isBaseDOMWidget(resolved.widget)) {
      syncDomOverride(subgraphNode, nodeId, widgetName, view)
      return
    }

    const concrete = toConcreteWidget(resolved.widget, resolved.node, false)
    if (concrete) {
      // Temporarily set the concrete widget's y to this view's y for drawing
      const originalY = concrete.y
      concrete.y = view.y
      concrete.drawWidget(ctx, { width: widget_width, showText: !lowQuality })
      concrete.y = originalY
    }
  }

  // Layout sizing — delegate to interior widget's computeLayoutSize.
  // Use a getter so typeof check returns 'function' only when the
  // interior widget actually has computeLayoutSize (otherwise
  // _arrangeWidgets treats it as a fixed-size widget).
  Object.defineProperty(view, 'computeLayoutSize', {
    get: () => {
      const resolved = resolve(subgraphNode, nodeId, widgetName)
      if (!resolved?.widget.computeLayoutSize) return undefined
      return (node: LGraphNode) => resolved.widget.computeLayoutSize!(node)
    },
    enumerable: true,
    configurable: true
  })

  // Callback forwarding
  view.callback = function (
    value: unknown,
    canvas?: LGraphCanvas,
    node?: LGraphNode,
    pos?: Point,
    e?: CanvasPointerEvent
  ) {
    const resolved = resolve(subgraphNode, nodeId, widgetName)
    resolved?.widget.callback?.(value, canvas, node, pos, e)
  }

  return view
}

/** Checks if a widget is a BaseDOMWidget (DOMWidget or ComponentWidget). */
function isBaseDOMWidget(
  widget: IBaseWidget
): widget is IBaseWidget & { id: string } {
  return 'id' in widget && ('element' in widget || 'component' in widget)
}

/**
 * If the interior widget is a DOM widget, register (or update) the
 * position override so DomWidgets.vue renders it on the SubgraphNode.
 * Called from both the `y` setter (covers Vue nodes mode where draw()
 * is never called) and `draw()` (covers legacy canvas mode).
 */
function syncDomOverride(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string,
  view: PromotedWidgetView
) {
  const resolved = resolve(subgraphNode, nodeId, widgetName)
  if (!resolved || !isBaseDOMWidget(resolved.widget)) return
  useDomWidgetStore().setPositionOverride(resolved.widget.id, {
    node: subgraphNode,
    widget: view
  })
}

function drawDisconnectedPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  H: number
) {
  ctx.save()
  ctx.fillStyle = '#333'
  ctx.fillRect(15, y, width - 30, H)
  ctx.fillStyle = '#999'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Disconnected', width / 2, y + H / 2)
  ctx.restore()
}
