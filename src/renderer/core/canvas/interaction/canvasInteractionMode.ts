import type { CanvasInteractionModeReader } from '@/lib/litegraph/src/litegraph'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

export function createCanvasInteractionMode(): CanvasInteractionModeReader {
  const agentNodeSelectionStore = useAgentNodeSelectionStore()
  return { isSelectOnly: () => agentNodeSelectionStore.isActive }
}
