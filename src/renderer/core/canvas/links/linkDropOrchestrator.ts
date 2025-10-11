import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import type { SlotDropCandidate } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLinkDragContext } from '@/renderer/extensions/vueNodes/composables/slotLinkDragContext'

interface DropResolutionContext {
  adapter: LinkConnectorAdapter | null
  graph: LGraph | null
  session: SlotLinkDragContext
}

export const resolveSlotTargetCandidate = (
  target: EventTarget | null,
  { adapter, graph }: DropResolutionContext
): SlotDropCandidate | null => {
  const { setCompatibleFor, getCompatible } = useSlotLinkDragUIState()
  if (!(target instanceof HTMLElement)) return null

  const elWithSlot = target.closest<HTMLElement>(
    '[data-node-id][data-slot-type][data-slot-index]'
  )
  const nodeId = elWithSlot?.dataset['nodeId']
  const typeAttr = elWithSlot?.dataset['slotType'] as
    | 'input'
    | 'output'
    | undefined
  const indexAttr = elWithSlot?.dataset['slotIndex']
  if (!nodeId || !typeAttr || indexAttr == null) return null
  const index = Number.parseInt(indexAttr, 10)
  if (!Number.isFinite(index)) return null

  const layout = layoutStore.getSlotLayoutBy(nodeId, typeAttr, index)
  if (!layout) return null

  const candidate: SlotDropCandidate = { layout, compatible: false }

  if (adapter && graph) {
    const cached = getCompatible(nodeId, layout.type, layout.index)
    if (cached != null) {
      candidate.compatible = cached
    } else {
      const layoutNodeId: NodeId = layout.nodeId
      const compatible =
        layout.type === 'input'
          ? adapter.isInputValidDrop(layoutNodeId, layout.index)
          : adapter.isOutputValidDrop(layoutNodeId, layout.index)

      setCompatibleFor(layoutNodeId, layout.type, layout.index, compatible)
      candidate.compatible = compatible
    }
  }

  return candidate
}

export const resolveNodeSurfaceSlotCandidate = (
  target: EventTarget | null,
  { adapter, graph, session }: DropResolutionContext
): SlotDropCandidate | null => {
  const { setCompatibleFor } = useSlotLinkDragUIState()
  if (!(target instanceof HTMLElement)) return null

  const elWithNode = target.closest<HTMLElement>('[data-node-id]')
  const nodeIdAttr = elWithNode?.dataset['nodeId']
  if (!nodeIdAttr) return null

  if (!adapter || !graph) return null

  const nodeId: NodeId = nodeIdAttr

  const cachedPreferredSlotForNode = session.preferredSlotForNode.get(nodeId)
  if (cachedPreferredSlotForNode !== undefined) {
    return cachedPreferredSlotForNode
      ? { layout: cachedPreferredSlotForNode.layout, compatible: true }
      : null
  }

  const node = graph.getNodeById(nodeId)
  if (!node) return null

  const firstLink = adapter.renderLinks[0]
  if (!firstLink) return null

  const connectingTo = adapter.linkConnector.state.connectingTo
  if (connectingTo !== 'input' && connectingTo !== 'output') return null

  const isInput = connectingTo === 'input'
  const slotType = firstLink.fromSlot.type

  const result = isInput
    ? node.findInputByType(slotType)
    : node.findOutputByType(slotType)

  const index = result?.index
  if (index == null) {
    session.preferredSlotForNode.set(nodeId, null)
    return null
  }

  const layout = layoutStore.getSlotLayoutBy(
    String(nodeId),
    isInput ? 'input' : 'output',
    index
  )
  if (!layout) {
    session.preferredSlotForNode.set(nodeId, null)
    return null
  }

  const compatible = isInput
    ? adapter.isInputValidDrop(nodeId, index)
    : adapter.isOutputValidDrop(nodeId, index)

  setCompatibleFor(layout.nodeId, layout.type, layout.index, compatible)

  if (!compatible) {
    session.preferredSlotForNode.set(nodeId, null)
    return null
  }

  const preferred = {
    index,
    identity: { nodeId: layout.nodeId, type: layout.type, index },
    layout
  }
  session.preferredSlotForNode.set(nodeId, preferred)

  return { layout, compatible: true }
}
