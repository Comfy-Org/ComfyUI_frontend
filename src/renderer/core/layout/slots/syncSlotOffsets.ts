import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotOffset, SlotOffsetMode } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'
import { parseSlotId } from '@/types/slotId'
import type { UUID } from '@/utils/uuid'

export function syncSlotOffsets(
  element: HTMLElement,
  graphId: UUID,
  nodeId: NodeId
): void {
  const nodeElement = element.closest<HTMLElement>('[data-node-id]') ?? element
  const mode = getSlotOffsetMode(nodeElement)
  const slotElements =
    nodeElement.querySelectorAll<HTMLElement>('[data-slot-key]')
  if (slotElements.length === 0) {
    layoutStore.updateNodeSlotOffsets(graphId, nodeId, [], mode)
    return
  }

  const nodeRect = nodeElement.getBoundingClientRect()
  const scale = nodeElement.offsetWidth
    ? nodeRect.width / nodeElement.offsetWidth
    : 0
  if (scale <= 0) return

  const offsets = Array.from(slotElements).flatMap((slotElement) => {
    const offset = measureSlotOffset({
      slotElement,
      nodeId,
      nodeRect,
      nodeWidth: nodeElement.offsetWidth,
      scale,
      mode
    })
    return offset ? [offset] : []
  })
  layoutStore.updateNodeSlotOffsets(graphId, nodeId, offsets, mode)
}

function getSlotOffsetMode(nodeElement: HTMLElement): SlotOffsetMode {
  return nodeElement.dataset.collapsed !== undefined ? 'collapsed' : 'expanded'
}

function measureSlotOffset({
  slotElement,
  nodeId,
  nodeRect,
  nodeWidth,
  scale,
  mode
}: {
  slotElement: HTMLElement
  nodeId: NodeId
  nodeRect: DOMRectReadOnly
  nodeWidth: number
  scale: number
  mode: SlotOffsetMode
}): SlotOffset | null {
  const slotId = parseSlotId(slotElement.dataset.slotKey ?? '')
  if (!slotId || slotId.nodeId !== nodeId) return null

  const slotRect = slotElement.getBoundingClientRect()
  if (slotRect.width <= 0 || slotRect.height <= 0) return null

  const centerX = (slotRect.left + slotRect.width / 2 - nodeRect.x) / scale
  return {
    index: slotId.index,
    type: slotId.direction,
    position: {
      x:
        mode === 'collapsed'
          ? centerX
          : slotId.direction === 'input'
            ? 0
            : nodeWidth,
      y:
        (slotRect.top + slotRect.height / 2 - nodeRect.y) / scale -
        LiteGraph.NODE_TITLE_HEIGHT
    }
  }
}
