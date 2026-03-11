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

    const zIndexMap = new Map<string, number>()

    for (const [nodeId, layout] of allNodes) {
      const graphNode = this.graph?._nodes?.find((n) => String(n.id) === nodeId)

      const executionState = nodeProgressStates[nodeId]?.state ?? null

      zIndexMap.set(nodeId, layout.zIndex)
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

    nodes.sort(
      (a, b) =>
        (zIndexMap.get(String(a.id)) ?? 0) - (zIndexMap.get(String(b.id)) ?? 0)
    )

    return nodes
  }

  getNodeCount(): number {
    return layoutStore.getAllNodes().value.size
  }

  hasData(): boolean {
    return this.getNodeCount() > 0
  }
}
