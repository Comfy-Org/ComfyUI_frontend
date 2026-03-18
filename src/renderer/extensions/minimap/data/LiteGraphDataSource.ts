import { useExecutionStore } from '@/stores/executionStore'

import type { MinimapNodeData } from '../types'
import { AbstractMinimapDataSource } from './AbstractMinimapDataSource'

/**
 * LiteGraph data source implementation
 */
export class LiteGraphDataSource extends AbstractMinimapDataSource {
  getNodes(): MinimapNodeData[] {
    if (!this.graph?._nodes) return []

    const executionStore = useExecutionStore()
    const nodeProgressStates = executionStore.nodeProgressStates

    return this.graph._nodes.map((node) => {
      const nodeId = String(node.id)
      const executionState = nodeProgressStates[nodeId]?.state ?? null

      return {
        id: nodeId,
        x: node.pos[0],
        y: node.pos[1],
        width: node.size[0],
        height: node.size[1],
        bgcolor: node.bgcolor,
        mode: node.mode,
        hasErrors: node.has_errors,
        executionState
      }
    })
  }

  getNodeCount(): number {
    return this.graph?._nodes?.length ?? 0
  }

  hasData(): boolean {
    return this.getNodeCount() > 0
  }
}
