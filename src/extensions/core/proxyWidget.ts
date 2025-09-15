import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { disconnectedWidget } from '@/lib/litegraph/src/widgets/DisconnectedWidget'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { useExtensionService } from '@/services/extensionService'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

const canvasStore = useCanvasStore()

export const proxyWidgetsPropertySchema = z.array(
  z.tuple([z.string(), z.string()])
)
export type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>
//export type proxyWidgetsProperty = [string, string][]

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  if (typeof property !== 'string') {
    console.error(`Found non-string value for properties.proxyWidgets`)
    return []
  }
  const parsed = JSON.parse(property)
  const result = proxyWidgetsPropertySchema.safeParse(parsed)
  if (result.success) return result.data ?? []

  const error = fromZodError(result.error)
  console.error(`Invalid assignment for properties.proxyWidgets:\n${error}`)
  return []
}

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
    }
  })
  subgraphNode.properties.proxyWidgets = proxyWidgets
}
type Overlay = {
  graph: LGraph
  nodeId: string
  widgetName: string
  label: string
  isProxyWidget: boolean
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
  const overlay = {
    nodeId,
    widgetName,
    graph: subgraphNode.subgraph,
    label: `${nodeId}: ${widgetName}`,
    isProxyWidget: true
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
  //TODO: call toConcrete when resolved and hold reference?
  //NOTE: From testing, WeakRefs never dropped. May refactor later
  let [linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
  const handler = Object.fromEntries(
    ['get', 'set', 'getPrototypeOf', 'ownKeys', 'has'].map((s) => {
      const func = function (t: object, p: string, ...rest: object[]) {
        if (s == 'get' && p == '_overlay') return overlay
        if (!linkedWidget)
          [linkedNode, linkedWidget] = resolveLinkedWidget(overlay)
        const bw = linkedWidget ?? disconnectedWidget
        if (s == 'get' && p == 'node') {
          return subgraphNode
        }
        if (s == 'set' && p == 'computedDisabled') {
          //ignore setting, calc actual
          bw.computedDisabled =
            bw.disabled || linkedNode!.getSlotFromWidget(bw)?.link != null
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
        return (Reflect as any)[s](t, p, ...rest.slice(0, -1), r)
      }
      return [s, func]
    })
  )
  const w = new Proxy(overlay, handler) as unknown as ProxyWidget
  subgraphNode.widgets.push(w)
  return w
}
