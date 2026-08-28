import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { findFirstNode } from '@/lib/litegraph/src/utils/collections'

export function getSelectedNode(canvas: LGraphCanvas) {
  return findFirstNode(canvas.selectedItems)
}
