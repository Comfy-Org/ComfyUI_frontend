import type { CanvasInteractionModeReader } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

export function createCanvasInteractionMode(): CanvasInteractionModeReader {
  const canvasStore = useCanvasStore()
  return { isSelectOnly: () => canvasStore.isPickingNodes }
}
