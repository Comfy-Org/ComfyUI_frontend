import type {
  MinimapNodeExecutionState,
  MinimapNodeProgressStates
} from '@/renderer/extensions/minimap/types'
import { parseNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

export function getMinimapExecutionStates(
  progressStates: MinimapNodeProgressStates,
  subgraphId: string | null
): Map<NodeId, MinimapNodeExecutionState> {
  const states = new Map<NodeId, MinimapNodeExecutionState>()
  for (const [locatorId, progress] of Object.entries(progressStates)) {
    const locator = parseNodeLocatorId(locatorId)
    if (locator?.subgraphUuid === subgraphId) {
      states.set(locator.localNodeId, progress.state)
    }
  }
  return states
}
