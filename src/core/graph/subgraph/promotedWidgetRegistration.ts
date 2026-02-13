import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

let registered = false

/**
 * Registers the promoted widget system using PromotedWidgetSlot instances.
 * Sets up:
 * - `subgraph-opened` event: syncs `promoted` flags on interior widgets
 * - `subgraph-converted` event: auto-promotes recommended widgets
 * - `onConfigure` override: creates PromotedWidgetSlot instances in widgets[]
 *
 * Prototype patching is necessary because `onConfigure` must be set before
 * SubgraphNode construction (called during `configure()` in the constructor).
 */
export function registerPromotedWidgetSlots(canvas: LGraphCanvas) {
  if (registered) return
  registered = true

  canvas.canvas.addEventListener<'subgraph-opened'>('subgraph-opened', (e) => {
    const { subgraph, fromNode } = e.detail
    const proxyWidgets = parseProxyWidgets(fromNode.properties.proxyWidgets)
    for (const node of subgraph.nodes) {
      for (const widget of node.widgets ?? []) {
        if (widget instanceof PromotedWidgetSlot) continue
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

/**
 * Reconstructs the promoted widget slots on a subgraph node based on
 * a serialized proxy widgets list.
 *
 * This replaces the previous side-effecting property setter pattern where
 * assigning to `properties.proxyWidgets` would trigger widget reconstruction.
 */
function syncPromotedWidgets(
  node: LGraphNode & { isSubgraphNode(): boolean },
  property: NodeProperty
): void {
  const canvasStore = useCanvasStore()
  const parsed = parseProxyWidgets(property)

  const widgets = node.widgets ?? []

  // Dispose DOM adapters on existing PromotedWidgetSlots being removed.
  for (const w of widgets) {
    if (w instanceof PromotedWidgetSlot) w.disposeDomAdapter()
  }

  // Collect stubs created by _setWidget() during configure.
  const stubs = widgets.filter(
    (
      w
    ): w is IBaseWidget & { sourceNodeId: string; sourceWidgetName: string } =>
      !(w instanceof PromotedWidgetSlot) &&
      'sourceNodeId' in w &&
      'sourceWidgetName' in w
  )

  // Remove all promoted widgets (both PromotedWidgetSlots and stubs)
  node.widgets = widgets.filter(
    (w) =>
      !(w instanceof PromotedWidgetSlot) &&
      !(stubs as IBaseWidget[]).includes(w)
  )

  const subgraphNode = node as SubgraphNode
  const covered = new Set<string>()

  const newSlots: IBaseWidget[] = parsed.flatMap(([nodeId, widgetName]) => {
    let resolvedNodeId = nodeId
    let resolvedWidgetName = widgetName

    // Legacy `-1` entries: resolve via subgraph input wiring
    if (nodeId === '-1') {
      const subgraph = subgraphNode.subgraph
      const inputSlot = subgraph?.inputNode?.slots.find(
        (s) => s.name === widgetName
      )
      if (!inputSlot || !subgraph) return []

      const linkId = inputSlot.linkIds[0]
      const link = linkId != null ? subgraph.getLink(linkId) : undefined
      if (!link) return []

      const resolved = link.resolve(subgraph)
      const inputWidgetName = resolved.input?.widget?.name
      if (!resolved.inputNode || !inputWidgetName) return []

      resolvedNodeId = String(resolved.inputNode.id)
      resolvedWidgetName = inputWidgetName
    }

    covered.add(`${resolvedNodeId}:${resolvedWidgetName}`)
    return [
      new PromotedWidgetSlot(subgraphNode, resolvedNodeId, resolvedWidgetName)
    ]
  })

  // Add PromotedWidgetSlots for stubs not in the parsed list
  // (e.g. old workflows that didn't serialize slot-promoted entries)
  for (const stub of stubs) {
    const key = `${stub.sourceNodeId}:${stub.sourceWidgetName}`
    if (covered.has(key)) continue
    newSlots.unshift(
      new PromotedWidgetSlot(
        subgraphNode,
        stub.sourceNodeId,
        stub.sourceWidgetName
      )
    )
  }

  node.widgets.push(...newSlots)

  // Update input._widget references to point to the new PromotedWidgetSlots
  // instead of the stubs they replaced.
  for (const input of subgraphNode.inputs) {
    const oldWidget = input._widget
    if (
      !oldWidget ||
      !('sourceNodeId' in oldWidget) ||
      !('sourceWidgetName' in oldWidget)
    )
      continue

    const sid = String(oldWidget.sourceNodeId)
    const swn = String(oldWidget.sourceWidgetName)
    const replacement = newSlots.find(
      (w) =>
        w instanceof PromotedWidgetSlot &&
        w.sourceNodeId === sid &&
        w.sourceWidgetName === swn
    )
    if (replacement) input._widget = replacement
  }

  canvasStore.canvas?.setDirty(true, true)
  node._setConcreteSlots()
  node.arrange()
}

const originalOnConfigure = SubgraphNode.prototype.onConfigure
const onConfigure = function (
  this: LGraphNode,
  serialisedNode: ISerialisedNode
) {
  if (!this.isSubgraphNode())
    throw new Error("Can't add promoted widgets to non-subgraphNode")

  this.properties.proxyWidgets ??= []

  originalOnConfigure?.call(this, serialisedNode)

  Object.defineProperty(this.properties, 'proxyWidgets', {
    get: () =>
      this.widgets.map((w) => {
        if (w instanceof PromotedWidgetSlot)
          return [w.sourceNodeId, w.sourceWidgetName]
        if ('sourceNodeId' in w && 'sourceWidgetName' in w)
          return [String(w.sourceNodeId), String(w.sourceWidgetName)]
        return ['-1', w.name]
      }),
    set: (value: NodeProperty) => syncPromotedWidgets(this, value)
  })

  if (serialisedNode.properties?.proxyWidgets) {
    syncPromotedWidgets(this, serialisedNode.properties.proxyWidgets)
  }
}
