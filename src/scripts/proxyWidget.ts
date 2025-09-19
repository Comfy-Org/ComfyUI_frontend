import { useNodeImage } from '@/composables/node/useNodeImage'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'
import { parseProxyWidgets } from '@/schemas/proxyWidget'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

const originalConfigureAfterSlots =
  SubgraphNode.prototype._internalConfigureAfterSlots
SubgraphNode.prototype._internalConfigureAfterSlots = function () {
  const canvasStore = useCanvasStore()
  const subgraphNode = this
  //Must give value to proxyWidgets prior to injecting or it won't serialize
  subgraphNode.properties.proxyWidgets ??= '[]'
  const proxyWidgets = subgraphNode.properties.proxyWidgets

  //Takes no arguements, returns nothing
  //Sometimes called multiple times on initialization, sometimes once
  //Clobbers all widgets
  originalConfigureAfterSlots?.bind(this)?.()

  Object.defineProperty(subgraphNode.properties, 'proxyWidgets', {
    get: () => {
      const result = subgraphNode.widgets
        .filter((w) => isProxyWidget(w))
        .map((w) => [w._overlay.nodeId, w._overlay.widgetName])
      return JSON.stringify(result)
    },
    set: (property: string) => {
      const parsed = parseProxyWidgets(property)
      const { widgetStates } = useDomWidgetStore()
      for (const w of subgraphNode.widgets ?? []) {
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
      canvasStore.canvas?.setDirty(true, true)
      subgraphNode._setConcreteSlots()
      subgraphNode.arrange()
    }
  })
  subgraphNode.properties.proxyWidgets = proxyWidgets
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
    onRemove: undefined
  }
  return addProxyFromOverlay(subgraphNode, overlay)
}
function resolveLinkedWidget(
  overlay: Overlay
): [LGraphNode | undefined, IBaseWidget | undefined] {
  const { graph, nodeId, widgetName } = overlay
  let g: LGraph | undefined = graph
  let n: LGraphNode | SubgraphNode | undefined = undefined
  for (const id of nodeId.split(':')) {
    n = g?._nodes_by_id?.[id]
    g = n?.isSubgraphNode?.() ? n.subgraph : undefined
  }
  if (!n) return [undefined, undefined]
  return [n, n.widgets?.find((w: IBaseWidget) => w.name === widgetName)]
}
function addProxyFromOverlay(subgraphNode: SubgraphNode, overlay: Overlay) {
  let [linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
  const bw = linkedWidget ?? disconnectedWidget
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
  const handler = Object.fromEntries(
    ['get', 'set', 'getPrototypeOf', 'ownKeys', 'has'].map((s) => {
      const func = function (t: object, p: string, ...rest: object[]) {
        if (s == 'get' && p == '_overlay') return overlay
        let r = rest.at(-1)
        if (overlay.hasOwnProperty(p)) r = t = overlay
        else {
          t = bw
          if (p == 'value') r = t
        }
        return (Reflect as any)[s](t, p, ...rest.slice(0, -1), r)
      }
      return [s, func]
    })
  )
  const w = new Proxy(disconnectedWidget, handler)
  subgraphNode.widgets.push(w)
  return w
}
