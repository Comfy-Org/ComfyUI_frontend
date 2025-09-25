import { useNodeImage } from '@/composables/node/useNodeImage'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'
import { parseProxyWidgets } from '@/schemas/proxyWidget'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

export function registerProxyWidgets(canvas: LGraphCanvas) {
  //NOTE: canvasStore hasn't been initialized yet
  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    const pw = parseProxyWidgets(fromNode.properties.proxyWidgets)
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        widget.promoted = pw.some(([n, w]) => node.id == n && widget.name == w)
      }
    }
  })
  const originalOnConfigure = SubgraphNode.prototype.onConfigure
  SubgraphNode.prototype.onConfigure = function onConfigure(serialisedNode) {
    if (!this.isSubgraphNode())
      throw new Error("Can't add proxyWidgets to non-subgraphNode")

    const canvasStore = useCanvasStore()
    const subgraphNode = this
    //Must give value to proxyWidgets prior to defining or it won't serialize
    subgraphNode.properties.proxyWidgets ??= '[]'
    let proxyWidgets = subgraphNode.properties.proxyWidgets

    originalOnConfigure?.bind(this)?.(serialisedNode)

    Object.defineProperty(subgraphNode.properties, 'proxyWidgets', {
      get: () => {
        return proxyWidgets
      },
      set: (property: string) => {
        const parsed = parseProxyWidgets(property)
        const { widgetStates } = useDomWidgetStore()
        for (const w of subgraphNode.widgets.filter((w) => isProxyWidget(w))) {
          if (w instanceof DOMWidgetImpl && widgetStates.has(w.id)) {
            const widgetState = widgetStates.get(w.id)
            if (!widgetState) continue
            widgetState.active = false
          }
        }
        //NOTE: This does not apply to pushed entries, only initial load
        subgraphNode.widgets = subgraphNode.widgets.filter(
          (w) => !isProxyWidget(w)
        )
        for (const [nodeId, widgetName] of parsed) {
          const w = addProxyWidget(subgraphNode, `${nodeId}`, widgetName)
          if (w instanceof DOMWidgetImpl) {
            const widgetState = widgetStates.get(w.id)
            if (!widgetState) continue
            widgetState.active = true
            widgetState.widget = w
          }
        }
        proxyWidgets = property
        canvasStore.canvas?.setDirty(true, true)
        subgraphNode._setConcreteSlots()
        subgraphNode.arrange()
      }
    })
    subgraphNode.properties.proxyWidgets = proxyWidgets
  }
}

type Overlay = Partial<IBaseWidget> & {
  graph: LGraph
  nodeId: string
  widgetName: string
  isProxyWidget: boolean
  node?: LGraphNode
}
type ProxyWidget = IBaseWidget & { _overlay: Overlay }
function isProxyWidget(w: IBaseWidget): w is ProxyWidget {
  return (w as { _overlay?: Overlay })?._overlay?.isProxyWidget ?? false
}

function addProxyWidget(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string
) {
  const name = `${nodeId}: ${widgetName}`
  const overlay = {
    nodeId,
    widgetName,
    graph: subgraphNode.subgraph,
    name,
    label: name,
    isProxyWidget: true,
    y: 0,
    last_y: undefined,
    width: undefined,
    computedHeight: undefined,
    afterQueued: undefined,
    onRemove: undefined,
    node: subgraphNode,
    promoted: undefined
  }
  return addProxyFromOverlay(subgraphNode, overlay)
}
function resolveLinkedWidget(
  overlay: Overlay
): [LGraphNode | undefined, IBaseWidget | undefined] {
  const { graph, nodeId, widgetName } = overlay
  const n = getNodeByExecutionId(graph, nodeId)
  if (!n) return [undefined, undefined]
  return [n, n.widgets?.find((w: IBaseWidget) => w.name === widgetName)]
}
function addProxyFromOverlay(subgraphNode: SubgraphNode, overlay: Overlay) {
  let [linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
  let backingWidget = linkedWidget ?? disconnectedWidget
  if (overlay.widgetName == '$$canvas-image-preview')
    overlay.node = new Proxy(subgraphNode, {
      get(_t, p) {
        if (p == 'imgs') {
          if (linkedNode) {
            const images =
              useNodeOutputStore().getNodeOutputs(linkedNode)?.images ?? []
            if (images !== linkedNode.images) {
              linkedNode.images = images
              useNodeImage(linkedNode).showPreview()
            }
            return linkedNode.imgs
          }
          return []
        }
        return Reflect.get(subgraphNode, p)
      }
    })
  /**
   * A set of handlers which define widget interaction
   * Many arguments are shared between function calls
   * @param {{IBaseWidget} _t - The "target" the call is originally made on.
   *   This argument is never used, but must be defined for typechecking
   * @param {{string}} property - The name of the accessed value.
   *   Checked for conditional logic, but never changed
   * @param {{object}} receiver - The object the result is set to
   *   and the vlaue used as 'this' if property is a get/set method
   * @param {{unknown}} value - only used on set calls. The thing being assigned
   */
  const handler = {
    get(_t: IBaseWidget, property: string, receiver: object) {
      let redirectedTarget: object = backingWidget
      let redirectedReceiver = receiver
      if (property == '_overlay') return overlay
      else if (property == 'value') redirectedReceiver = backingWidget
      if (overlay.hasOwnProperty(property)) {
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
        //update linkage regularly, but no more than once per frame
        ;[linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
        backingWidget = linkedWidget ?? disconnectedWidget
      }
      if (overlay.hasOwnProperty(property)) {
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
      if (overlay.hasOwnProperty(property)) {
        redirectedTarget = overlay
      }
      return Reflect.has(redirectedTarget, property)
    }
  }
  const w = new Proxy(disconnectedWidget, handler)
  subgraphNode.widgets.push(w)
  return w
}
