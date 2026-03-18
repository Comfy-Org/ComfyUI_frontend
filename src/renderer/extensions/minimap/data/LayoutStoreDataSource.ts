import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useExecutionStore } from '@/stores/executionStore'

import type { MinimapNodeData } from '../types'
import { AbstractMinimapDataSource } from './AbstractMinimapDataSource'

let executionStore: ReturnType<typeof useExecutionStore> | null = null

/**
 * Layout Store data source implementation
 */
export class LayoutStoreDataSource extends AbstractMinimapDataSource {
  getNodes(): MinimapNodeData[] {
    const allNodes = layoutStore.getAllNodes().value
    if (allNodes.size === 0) return []

    if (!executionStore) {
      executionStore = useExecutionStore()
    }
    const nodeProgressStates = executionStore.nodeLocationProgressStates

    const nodes: MinimapNodeData[] = []

    for (const [nodeId, layout] of allNodes) {
      // Find corresponding LiteGraph node for additional properties
      const graphNode = this.graph?._nodes?.find((n) => String(n.id) === nodeId)

      const executionState = nodeProgressStates[nodeId]?.state ?? null

      nodes.push({
        id: nodeId,
        x: layout.position.x,
        y: layout.position.y,
        width: layout.size.width,
        height: layout.size.height,
        bgcolor: graphNode?.bgcolor,
        mode: graphNode?.mode,
        hasErrors: graphNode?.has_errors,
        executionState
      })
    }

    return nodes
  }

  getNodeCount(): number {
    return layoutStore.getAllNodes().value.size
  }

  hasData(): boolean {
    return this.getNodeCount() > 0
  }
}
