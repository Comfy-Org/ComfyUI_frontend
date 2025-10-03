import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import type { SlotDropCandidate } from '@/renderer/core/canvas/links/slotLinkDragState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLinkDragSession } from '@/renderer/extensions/vueNodes/composables/slotLinkDragSession'

interface DropResolutionContext {
  adapter: LinkConnectorAdapter | null
  graph: LGraph | null
  session: SlotLinkDragSession
}

export const resolveSlotTargetCandidate = (
  target: EventTarget | null,
  { adapter, graph, session }: DropResolutionContext
): SlotDropCandidate | null => {
  if (!(target instanceof HTMLElement)) return null

  const elWithKey = target.closest<HTMLElement>('[data-slot-key]')
  const key = elWithKey?.dataset['slotKey']
  if (!key) return null

  const layout = layoutStore.getSlotLayout(key)
  if (!layout) return null

  const candidate: SlotDropCandidate = { layout, compatible: false }

  if (adapter && graph) {
    const cached = session.compatCache.get(key)
    if (cached != null) {
      candidate.compatible = cached
    } else {
      const nodeId = Number(layout.nodeId)
      const compatible =
        layout.type === 'input'
          ? adapter.isInputValidDrop(nodeId, layout.index)
          : adapter.isOutputValidDrop(nodeId, layout.index)

      session.compatCache.set(key, compatible)
      candidate.compatible = compatible
    }
  }

  return candidate
}

export const resolveNodeSurfaceCandidate = (
  target: EventTarget | null,
  { adapter, graph, session }: DropResolutionContext
): SlotDropCandidate | null => {
  if (!(target instanceof HTMLElement)) return null

  const elWithNode = target.closest<HTMLElement>('[data-node-id]')
  const nodeIdStr = elWithNode?.dataset['nodeId']
  if (!nodeIdStr) return null

  if (!adapter || !graph) return null

  const nodeId = Number(nodeIdStr)

  const cachedPreferred = session.nodePreferred.get(nodeId)
  if (cachedPreferred !== undefined) {
    return cachedPreferred
      ? { layout: cachedPreferred.layout, compatible: true }
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
    session.nodePreferred.set(nodeId, null)
    return null
  }

  const key = getSlotKey(String(nodeId), index, isInput)
  const layout = layoutStore.getSlotLayout(key)
  if (!layout) {
    session.nodePreferred.set(nodeId, null)
    return null
  }

  const compatible = isInput
    ? adapter.isInputValidDrop(nodeId, index)
    : adapter.isOutputValidDrop(nodeId, index)

  session.compatCache.set(key, compatible)

  if (!compatible) {
    session.nodePreferred.set(nodeId, null)
    return null
  }

  const preferred = { index, key, layout }
  session.nodePreferred.set(nodeId, preferred)

  return { layout, compatible: true }
}
