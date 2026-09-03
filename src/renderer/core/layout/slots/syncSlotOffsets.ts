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
  const mode: SlotOffsetMode =
    nodeElement.dataset.collapsed === undefined ? 'expanded' : 'collapsed'
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

  const offsets: SlotOffset[] = []
  for (const slotElement of slotElements) {
    const slotId = parseSlotId(slotElement.dataset.slotKey ?? '')
    if (!slotId || slotId.nodeId !== nodeId) continue

    const slotRect = slotElement.getBoundingClientRect()
    if (slotRect.width <= 0 || slotRect.height <= 0) continue

    offsets.push({
      index: slotId.index,
      type: slotId.direction,
      position: {
        x:
          mode === 'collapsed'
            ? (slotRect.left + slotRect.width / 2 - nodeRect.x) / scale
            : slotId.direction === 'input'
              ? 0
              : nodeElement.offsetWidth,
        y:
          (slotRect.top + slotRect.height / 2 - nodeRect.y) / scale -
          LiteGraph.NODE_TITLE_HEIGHT
      }
    })
  }
  layoutStore.updateNodeSlotOffsets(graphId, nodeId, offsets, mode)
}
