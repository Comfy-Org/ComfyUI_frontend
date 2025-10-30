import {
  demoteWidget,
  promoteRecommendedWidgets
} from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { useLitegraphService } from '@/services/litegraphService'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

/**
 * @typedef {object} Overlay - Each proxy Widget has an associated overlay object
 * Accessing a property which exists in the overlay object will
 * instead result in the action being performed on the overlay object
 * 3 properties are added for locating the proxied widget
 * @property {LGraph} graph - The graph the widget resides in. Used for widget lookup
 * @property {string} nodeId - The NodeId the proxy Widget is located on
 * @property {string} widgetName - The name of the linked widget
 *
 * @property {boolean} isProxyWidget - Always true, used as type guard
 * @property {LGraphNode} node - not included on IBaseWidget, but required for overlay
 */
type Overlay = Partial<IBaseWidget> & {
  graph: LGraph
  nodeId: string
  widgetName: string
  isProxyWidget: boolean
  node?: LGraphNode
}
// A ProxyWidget can be treated like a normal widget.
// the _overlay property can be used to directly access the Overlay object
/**
 * @typedef {object} ProxyWidget - a reference to a widget that can
 * be displayed and owned by a separate node
 * @property {Overlay} _overlay - a special property to access the overlay of the widget
 * Any property that exists in the overlay will be accessed instead of the property
 * on the linked widget
 */
type ProxyWidget = IBaseWidget & { _overlay: Overlay }
export function isProxyWidget(w: IBaseWidget): w is ProxyWidget {
  return (w as { _overlay?: Overlay })?._overlay?.isProxyWidget ?? false
}
export function isDisconnectedWidget(w: ProxyWidget) {
  return w instanceof disconnectedWidget.constructor
}

export function registerProxyWidgets(canvas: LGraphCanvas) {
  //NOTE: canvasStore hasn't been initialized yet
  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    const proxyWidgets = parseProxyWidgets(fromNode.properties.proxyWidgets)
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        widget.promoted = proxyWidgets.some(
          ([n, w]) => node.id == n && widget.name == w
        )
      }
    }
  })
  canvas.canvas.addEventListener<'subgraph-converted'>(
    'subgraph-converted',
    (e) => promoteRecommendedWidgets(e.detail.subgraphNode)
  )
  SubgraphNode.prototype.onConfigure = onConfigure
}

const originalOnConfigure = SubgraphNode.prototype.onConfigure
const onConfigure = function (
  this: LGraphNode,
  serialisedNode: ISerialisedNode
) {
  if (!this.isSubgraphNode())
    throw new Error("Can't add proxyWidgets to non-subgraphNode")

  const canvasStore = useCanvasStore()
  //Must give value to proxyWidgets prior to defining or it won't serialize
  this.properties.proxyWidgets ??= []

  originalOnConfigure?.call(this, serialisedNode)

  Object.defineProperty(this.properties, 'proxyWidgets', {
    get: () =>
      this.widgets.map((w) =>
        isProxyWidget(w)
          ? [w._overlay.nodeId, w._overlay.widgetName]
          : ['-1', w.name]
      ),
    set: (property: NodeProperty) => {
      const parsed = parseProxyWidgets(property)
      const { deactivateWidget, setWidget } = useDomWidgetStore()
      const isActiveGraph = useCanvasStore().canvas?.graph === this.graph
      if (isActiveGraph) {
        for (const w of this.widgets.filter((w) => isProxyWidget(w))) {
          if (w instanceof DOMWidgetImpl) deactivateWidget(w.id)
        }
      }

      const newWidgets = parsed.flatMap(([nodeId, widgetName]) => {
        if (nodeId === '-1') {
          const widget = this.widgets.find((w) => w.name === widgetName)
          return widget ? [widget] : []
        }
        const w = newProxyWidget(this, nodeId, widgetName)
        if (isActiveGraph && w instanceof DOMWidgetImpl) setWidget(w)
        return [w]
      })
      this.widgets = this.widgets.filter(
        (w) => !isProxyWidget(w) && !parsed.some(([, name]) => w.name === name)
      )
      this.widgets.push(...newWidgets)

      canvasStore.canvas?.setDirty(true, true)
      this._setConcreteSlots()
      this.arrange()
    }
  })
  if (serialisedNode.properties?.proxyWidgets) {
    this.properties.proxyWidgets = serialisedNode.properties.proxyWidgets
    const parsed = parseProxyWidgets(serialisedNode.properties.proxyWidgets)
    serialisedNode.widgets_values?.forEach((v, index) => {
      if (parsed[index]?.[0] !== '-1') return
      const widget = this.widgets.find((w) => w.name == parsed[index][1])
      if (v !== null && widget) widget.value = v
    })
  }
}

function newProxyWidget(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string
) {
  const name = `${nodeId}: ${widgetName}`
  const overlay = {
    //items specific for proxy management
    nodeId,
    graph: subgraphNode.subgraph,
    widgetName,
    //Items which normally exist on widgets
    afterQueued: undefined,
    computedHeight: undefined,
    isProxyWidget: true,
    last_y: undefined,
    name,
    node: subgraphNode,
    onRemove: undefined,
    promoted: undefined,
    serialize: false,
    width: undefined,
    y: 0
  }
  return newProxyFromOverlay(subgraphNode, overlay)
}
function resolveLinkedWidget(
  overlay: Overlay
): [LGraphNode | undefined, IBaseWidget | undefined] {
  const { graph, nodeId, widgetName } = overlay
  const n = getNodeByExecutionId(graph, nodeId)
  if (!n) return [undefined, undefined]
  const widget = n.widgets?.find((w: IBaseWidget) => w.name === widgetName)
  //Slightly hacky. Force recursive resolution of nested widgets
  if (widget && isProxyWidget(widget) && isDisconnectedWidget(widget))
    widget.computedHeight = 20
  return [n, widget]
}

function newProxyFromOverlay(subgraphNode: SubgraphNode, overlay: Overlay) {
  const { updatePreviews } = useLitegraphService()
  let [linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
  let backingWidget = linkedWidget ?? disconnectedWidget
  if (overlay.widgetName.startsWith('$$')) {
    overlay.node = new Proxy(subgraphNode, {
      get(_t, p) {
        if (p !== 'imgs') return Reflect.get(subgraphNode, p)
        if (!linkedNode) return []
        return linkedNode.imgs
      }
    })
  }
  /**
   * A set of handlers which define widget interaction
   * Many arguments are shared between function calls
   * @param {IBaseWidget} _t - The "target" the call is originally made on.
   *   This argument is never used, but must be defined for typechecking
   * @param {string} property - The name of the accessed value.
   *   Checked for conditional logic, but never changed
   * @param {object} receiver - The object the result is set to
   *   and the value used as 'this' if property is a get/set method
   * @param {unknown} value - only used on set calls. The thing being assigned
   */
  const handler = {
    get(_t: IBaseWidget, property: string, receiver: object) {
      let redirectedTarget: object = backingWidget
      let redirectedReceiver = receiver
      if (property == '_overlay') return overlay
      else if (property == 'value') redirectedReceiver = backingWidget
      if (Object.prototype.hasOwnProperty.call(overlay, property)) {
        redirectedTarget = overlay
        redirectedReceiver = overlay
      }
      return Reflect.get(redirectedTarget, property, redirectedReceiver)
    },
    set(_t: IBaseWidget, property: string, value: unknown, receiver: object) {
      let redirectedTarget: object = backingWidget
      let redirectedReceiver = receiver
      if (property == 'value') redirectedReceiver = backingWidget
      else if (property == 'computedHeight') {
        if (overlay.widgetName.startsWith('$$') && linkedNode) {
          updatePreviews(linkedNode)
        }
        if (linkedNode && linkedWidget?.computedDisabled) {
          demoteWidget(linkedNode, linkedWidget, [subgraphNode])
        }
        //update linkage regularly, but no more than once per frame
        ;[linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
        backingWidget = linkedWidget ?? disconnectedWidget
      }
      if (Object.prototype.hasOwnProperty.call(overlay, property)) {
        redirectedTarget = overlay
        redirectedReceiver = overlay
      }
      return Reflect.set(redirectedTarget, property, value, redirectedReceiver)
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(backingWidget)
    },
    ownKeys() {
      return Reflect.ownKeys(backingWidget)
    },
    has(_t: IBaseWidget, property: string) {
      let redirectedTarget: object = backingWidget
      if (Object.prototype.hasOwnProperty.call(overlay, property)) {
        redirectedTarget = overlay
      }
      return Reflect.has(redirectedTarget, property)
    }
  }
  const w = new Proxy(disconnectedWidget, handler)
  return w
}
