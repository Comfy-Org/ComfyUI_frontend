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

  // Collect slot-promoted copies created by _setWidget() during configure.
  // These have sourceNodeId/sourceWidgetName set via Object.defineProperties.
  const copies = widgets.filter(
    (
      w
    ): w is IBaseWidget & { sourceNodeId: string; sourceWidgetName: string } =>
      !(w instanceof PromotedWidgetSlot) &&
      'sourceNodeId' in w &&
      'sourceWidgetName' in w
  )

  // Remove all promoted widgets (both PromotedWidgetSlots and copies)
  node.widgets = widgets.filter(
    (w) =>
      !(w instanceof PromotedWidgetSlot) &&
      !(copies as IBaseWidget[]).includes(w)
  )

  // Track which source widgets are covered by the parsed list
  const covered = new Set<string>()

  // Create PromotedWidgetSlots for all parsed entries.
  // Legacy `-1` entries are resolved to real IDs via the copies.
  const newSlots: IBaseWidget[] = parsed.flatMap(([nodeId, widgetName]) => {
    let resolvedNodeId = nodeId
    let resolvedWidgetName = widgetName

    if (nodeId === '-1') {
      const copy = copies.find((w) => w.name === widgetName)
      if (!copy) return []
      resolvedNodeId = copy.sourceNodeId
      resolvedWidgetName = copy.sourceWidgetName
    }

    covered.add(`${resolvedNodeId}:${resolvedWidgetName}`)
    return [
      new PromotedWidgetSlot(
        node as SubgraphNode,
        resolvedNodeId,
        resolvedWidgetName
      )
    ]
  })

  // Add PromotedWidgetSlots for any copies not in the parsed list
  // (e.g. old workflows that didn't serialize slot-promoted entries)
  for (const copy of copies) {
    const key = `${copy.sourceNodeId}:${copy.sourceWidgetName}`
    if (covered.has(key)) continue
    newSlots.unshift(
      new PromotedWidgetSlot(
        node as SubgraphNode,
        copy.sourceNodeId,
        copy.sourceWidgetName
      )
    )
  }

  node.widgets.push(...newSlots)

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
