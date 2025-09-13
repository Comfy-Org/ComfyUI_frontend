// @ts-nocheck
// FIXME: typechecking for proxy system
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'
import { useExtensionService } from '@/services/extensionService'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

useExtensionService().registerExtension({
  name: 'Comfy.SubgraphProxyWidgets',
  nodeCreated(node: LGraphNode) {
    if (node instanceof SubgraphNode) {
      setTimeout(() => injectProperty(node), 0)
    }
  }
})
function injectProperty(subgraphNode: SubgraphNode) {
  subgraphNode.properties.proxyWidgets ??= []
  const proxyWidgets = subgraphNode.properties.proxyWidgets
  Object.defineProperty(subgraphNode.properties, 'proxyWidgets', {
    get: () => {
      return subgraphNode.widgets
        .filter((w) => !!w._overlay)
        .map((w) => [w._overlay.nodeId, w._overlay.widgetName])
    },
    set: (property) => {
      const { widgetStates } = useDomWidgetStore()
      subgraphNode.widgets.forEach((w) => {
        if (w.id && widgetStates.has(w.id))
          widgetStates.get(w.id).active = false
      })
      //NOTE: This does not apply to pushed entries, only initial load
      subgraphNode.widgets = subgraphNode.widgets.filter((w) => !w._overlay)
      for (const [nodeId, widgetName] of property) {
        const w = addProxyWidget(subgraphNode, `${nodeId}`, widgetName)
        if (w.id && widgetStates.has(w.id)) {
          const widgetState = widgetStates.get(w.id)
          widgetState.active = true
          widgetState.widget = w
        }
      }
      //TODO: set dirty canvas
    }
  })
  subgraphNode.properties.proxyWidgets = proxyWidgets
}

function addProxyWidget(
  subgraphNode: SubgraphNode,
  nodeId: string,
  widgetName: string
) {
  const overlay = { nodeId, widgetName }
  return addProxyFromOverlay(subgraphNode, { __proto__: overlay })
}
function resolveLinkedWidget(graph, nodeId = '', widgetName) {
  const g = graph
  let n = undefined
  for (const id of nodeId.split(':')) {
    n = g?._nodes_by_id?.[id]
    graph = n?.subgraph
  }
  if (!n) return
  return n.widgets.find((w) => w.name === widgetName)
}
function getWidgetRef(overlay) {
  const lw = resolveLinkedWidget(
    overlay.graph,
    overlay.nodeId,
    overlay.widgetName
  )
  if (lw) return new WeakRef(lw)
  return { deref: () => undefined }
}
function addProxyFromOverlay(subgraphNode: SubgraphNode, overlay: object) {
  overlay.label = `${overlay.nodeId}: ${overlay.widgetName}`
  overlay.graph = subgraphNode.subgraph
  overlay.isProxyWidget = true
  //TODO: call toConcrete when resolved and hold reference?
  //NOTE: From testing, WeakRefs don't appear to actually drop
  //Memory management doesn't matter here and this is worthless for notification
  let linkedWidget = getWidgetRef(overlay)
  const handler = Object.fromEntries(
    ['get', 'set', 'getPrototypeOf', 'ownKeys', 'has'].map((s) => {
      const func = function (t, p, ...rest) {
        if (s == 'get' && p == '_overlay') return overlay
        if (!linkedWidget.deref()) linkedWidget = getWidgetRef(overlay)
        const bw = linkedWidget.deref() ?? disconnectedWidget
        if (s == 'get' && p == 'node') {
          return subgraphNode
        }
        if (s == 'set' && p == 'computedDisabled') {
          //ignore setting, calc actual
          bw.computedDisabled =
            bw.disabled || bw.node.getSlotFromWidget(bw)?.link != null
          return true
        }
        //NOTE: p may be undefined
        let r = rest.at(-1)
        if (
          [
            'y',
            'last_y',
            'width',
            'computedHeight',
            'afterQueued',
            'beforeQueued',
            'onRemove',
            'isProxyWidget',
            'label'
          ].includes(p)
        )
          t = overlay
        else {
          t = bw
          if (p == 'value') r = t
        }
        return Reflect[s](t, p, ...rest.slice(0, -1), r)
      }
      return [s, func]
    })
  )
  const w = new Proxy(overlay, handler)
  subgraphNode.widgets.push(w)
  return w
}
