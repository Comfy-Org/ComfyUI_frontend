import { PromotedWidgetSlot } from '@/core/graph/subgraph/PromotedWidgetSlot'
import { promoteRecommendedWidgets } from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { NodeId, NodeProperty } from '@/lib/litegraph/src/LGraphNode'
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

  // Snapshot native widgets before filtering so we can restore them
  const widgets = node.widgets ?? []

  const nativeWidgets = widgets.filter(
    (w) => !(w instanceof PromotedWidgetSlot)
  )

  // Remove existing PromotedWidgetSlot instances and native widgets
  // that will be re-ordered by the parsed list.
  // Dispose DOM adapters on slots being removed.
  for (const w of widgets) {
    if (w instanceof PromotedWidgetSlot) w.disposeDomAdapter()
  }
  node.widgets = widgets.filter((w) => {
    if (w instanceof PromotedWidgetSlot) return false
    return !parsed.some(([, name]) => w.name === name)
  })

  // Create PromotedWidgetSlot for each promoted entry.
  // For '-1' (slot-promoted) entries, resolve the interior source via
  // subgraph input links so they use the same delegation as context-menu
  // promoted widgets.
  const subgraphNode = node as SubgraphNode
  // Map from slot name → PromotedWidgetSlot for syncing input._widget refs
  const slotsByName = new Map<string, PromotedWidgetSlot>()
  const newSlots: IBaseWidget[] = parsed.flatMap(([nodeId, widgetName]) => {
    if (nodeId === '-1') {
      const source = resolveSlotPromotedSource(subgraphNode, widgetName)
      if (source) {
        const slot = new PromotedWidgetSlot(subgraphNode, source[0], source[1])
        slotsByName.set(widgetName, slot)
        return [slot]
      }
      const widget = nativeWidgets.find((w) => w.name === widgetName)
      return widget ? [widget] : []
    }
    return [new PromotedWidgetSlot(subgraphNode, nodeId, widgetName)]
  })
  node.widgets.push(...newSlots)

  // Sync input._widget references so litegraph lifecycle events
  // (removal, renaming) target the new PromotedWidgetSlot instances.
  for (const input of subgraphNode.inputs) {
    const slot = slotsByName.get(input.name)
    if (slot) input._widget = slot
  }

  canvasStore.canvas?.setDirty(true, true)
  node._setConcreteSlots()
  node.arrange()
}

/**
 * Follows the subgraph input slot's link chain to find the interior
 * node ID and widget name for a slot-promoted widget.
 */
function resolveSlotPromotedSource(
  subgraphNode: SubgraphNode,
  slotName: string
): [NodeId, string] | null {
  const subgraphInput = subgraphNode.subgraph.inputNode.slots.find(
    (slot) => slot.name === slotName
  )
  if (!subgraphInput) return null

  for (const linkId of subgraphInput.linkIds) {
    const link = subgraphNode.subgraph.getLink(linkId)
    if (!link) continue

    const { inputNode } = link.resolve(subgraphNode.subgraph)
    if (!inputNode) continue

    const targetInput = inputNode.inputs.find((inp) => inp.link === linkId)
    if (!targetInput) continue

    const widget = inputNode.getWidgetFromSlot(targetInput)
    if (widget) return [String(inputNode.id) as NodeId, widget.name]
  }
  return null
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
      this.widgets.map((w) =>
        w instanceof PromotedWidgetSlot
          ? [w.sourceNodeId, w.sourceWidgetName]
          : ['-1', w.name]
      ),
    set: (value: NodeProperty) => syncPromotedWidgets(this, value)
  })

  if (serialisedNode.properties?.proxyWidgets) {
    syncPromotedWidgets(this, serialisedNode.properties.proxyWidgets)
    const parsed = parseProxyWidgets(serialisedNode.properties.proxyWidgets)
    const subNode = this as SubgraphNode
    serialisedNode.widgets_values?.forEach((v, index) => {
      if (parsed[index]?.[0] !== '-1' || v === null) return
      const slotName = parsed[index][1]
      const widget =
        this.widgets.find((w) => w.name === slotName) ??
        subNode.inputs.find((inp) => inp.name === slotName)?._widget
      if (widget) widget.value = v
    })
  }
}
