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
function slotKey(nodeId: NodeId, widgetName: string): string {
  return `${nodeId}:${widgetName}`
}

/**
 * Resolves a legacy `-1` proxy entry to the actual interior node/widget
 * by following the subgraph input wiring.
 */
function resolveLegacyEntry(
  subgraphNode: SubgraphNode,
  widgetName: string
): [string, string] | null {
  const subgraph = subgraphNode.subgraph
  const inputSlot = subgraph?.inputNode?.slots.find(
    (s) => s.name === widgetName
  )
  if (!inputSlot || !subgraph) return null

  const linkId = inputSlot.linkIds[0]
  const link = linkId != null ? subgraph.getLink(linkId) : undefined
  if (!link) return null

  const inputNode = subgraph.getNodeById(link.target_id) ?? undefined
  if (!inputNode) return null

  // Find input by link ID rather than target_slot, since target_slot
  // can be unreliable in compressed workflows.
  const targetInput = inputNode.inputs?.find((inp) => inp.link === linkId)
  const inputWidgetName = targetInput?.widget?.name
  if (!inputWidgetName) return null

  return [String(inputNode.id), inputWidgetName]
}

/**
 * Reconciles the promoted widget slots on a subgraph node based on
 * a serialized proxy widgets list.
 *
 * Reuses existing PromotedWidgetSlot instances when possible to preserve
 * transient state (focus, DOM adapter, active input). Only creates new
 * slots for entries that don't have an existing match, and disposes
 * slots that are no longer needed.
 */
function syncPromotedWidgets(
  node: LGraphNode & { isSubgraphNode(): boolean },
  property: NodeProperty
): void {
  const canvasStore = useCanvasStore()
  const parsed = parseProxyWidgets(property)
  const subgraphNode = node as SubgraphNode
  const widgets = node.widgets ?? []

  // Index existing PromotedWidgetSlots by key for O(1) lookup
  const existingSlots = new Map<string, PromotedWidgetSlot>()
  for (const w of widgets) {
    if (w instanceof PromotedWidgetSlot) {
      existingSlots.set(slotKey(w.sourceNodeId, w.sourceWidgetName), w)
    }
  }

  // Collect stubs created by _setWidget() during configure
  const stubs = widgets.filter(
    (
      w
    ): w is IBaseWidget & { sourceNodeId: string; sourceWidgetName: string } =>
      !(w instanceof PromotedWidgetSlot) &&
      'sourceNodeId' in w &&
      'sourceWidgetName' in w
  )

  // Build the desired promoted slot list, reusing existing instances
  const desired = new Set<string>()
  const orderedSlots: IBaseWidget[] = []

  for (const [nodeId, widgetName] of parsed) {
    let resolvedNodeId = nodeId
    let resolvedWidgetName = widgetName

    if (nodeId === '-1') {
      const resolved = resolveLegacyEntry(subgraphNode, widgetName)
      if (!resolved) continue
      ;[resolvedNodeId, resolvedWidgetName] = resolved
    }

    const key = slotKey(resolvedNodeId, resolvedWidgetName)
    if (desired.has(key)) continue
    desired.add(key)

    const existing = existingSlots.get(key)
    if (existing) {
      orderedSlots.push(existing)
    } else {
      orderedSlots.push(
        new PromotedWidgetSlot(subgraphNode, resolvedNodeId, resolvedWidgetName)
      )
    }
  }

  // Promote stubs not covered by the parsed list
  // (e.g. old workflows that didn't serialize slot-promoted entries)
  for (const stub of stubs) {
    const key = slotKey(stub.sourceNodeId, stub.sourceWidgetName)
    if (desired.has(key)) continue
    desired.add(key)

    const existing = existingSlots.get(key)
    if (existing) {
      orderedSlots.unshift(existing)
    } else {
      orderedSlots.unshift(
        new PromotedWidgetSlot(
          subgraphNode,
          stub.sourceNodeId,
          stub.sourceWidgetName
        )
      )
    }
  }

  // Dispose DOM adapters only on slots that are being removed
  for (const [key, slot] of existingSlots) {
    if (!desired.has(key)) {
      slot.disposeDomAdapter()
    }
  }

  // Rebuild widgets array: non-promoted widgets in original order, then promoted slots
  node.widgets = widgets
    .filter(
      (w) =>
        !(w instanceof PromotedWidgetSlot) &&
        !(stubs as IBaseWidget[]).includes(w)
    )
    .concat(orderedSlots)

  // Update input._widget references to point to PromotedWidgetSlots
  // instead of stubs they replaced.
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
    const replacement = orderedSlots.find(
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

  this.refreshPromotedWidgets = () => {
    this.properties.proxyWidgets = this.properties.proxyWidgets
  }

  if (serialisedNode.properties?.proxyWidgets) {
    syncPromotedWidgets(this, serialisedNode.properties.proxyWidgets)
  }
}
