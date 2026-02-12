import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Registers the promoted widget system using PromotedWidgetSlot instances.
 * Sets up:
 * - `subgraph-opened` event: syncs `promoted` flags on interior widgets
 * - `subgraph-converted` event: auto-promotes recommended widgets
 * - `onConfigure` override: creates PromotedWidgetSlot instances in widgets[]
 */
export function registerPromotedWidgetSlots(canvas: LGraphCanvas) {
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
    throw new Error("Can't add promoted widgets to non-subgraphNode")

  const canvasStore = useCanvasStore()
  this.properties.proxyWidgets ??= []

  originalOnConfigure?.call(this, serialisedNode)

  Object.defineProperty(this.properties, 'proxyWidgets', {
    get: () =>
      this.widgets.map((w) =>
        w instanceof PromotedWidgetSlot
          ? [w.sourceNodeId, w.sourceWidgetName]
          : ['-1', w.name]
      ),
    set: (property: NodeProperty) => {
      const parsed = parseProxyWidgets(property)

      // Snapshot native widgets before filtering so we can restore them
      const nativeWidgets = this.widgets.filter(
        (w) => !(w instanceof PromotedWidgetSlot)
      )

      // Remove existing PromotedWidgetSlot instances and native widgets
      // that will be re-ordered by the parsed list
      this.widgets = this.widgets.filter((w) => {
        if (w instanceof PromotedWidgetSlot) return false
        return !parsed.some(([, name]) => w.name === name)
      })

      // Create new PromotedWidgetSlot for each promoted entry
      const newSlots: IBaseWidget[] = parsed.flatMap(([nodeId, widgetName]) => {
        if (nodeId === '-1') {
          const widget = nativeWidgets.find((w) => w.name === widgetName)
          return widget ? [widget] : []
        }
        return [
          new PromotedWidgetSlot(this as SubgraphNode, nodeId, widgetName)
        ]
      })
      this.widgets.push(...newSlots)

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
