import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeState } from '@/types/nodeState'

import type { MinimapGroupData, MinimapNodeData } from '../types'
import { AbstractMinimapDataSource } from './AbstractMinimapDataSource'

/**
 * Reads node geometry from `layoutStore`, which owns it while the Vue renderer
 * is mounted.
 *
 * Membership comes from `nodeDataStore`, scoped to the graph being viewed, so
 * layout entries belonging to another graph cannot reach the bounds calculation
 * however they came to be in the store.
 */
export class LayoutStoreDataSource extends AbstractMinimapDataSource {
  private viewedNodes(): NodeState[] {
    const graph = this.graph
    if (!graph) return []
    return useNodeDataStore().getGraphNodesFor(graph.rootGraph.id, graph.id)
  }

  getNodes(): MinimapNodeData[] {
    const states = this.viewedNodes()
    if (states.length === 0) return []

    const nodeProgressStates = useExecutionStore().nodeLocationProgressStates

    return states.flatMap((state): MinimapNodeData[] => {
      const layout = layoutStore.getNodeLayoutRef(state.id).value
      if (!layout) return []

      return [
        {
          id: state.id,
          x: layout.position.x,
          y: layout.position.y,
          width: layout.size.width,
          height: layout.size.height,
          bgcolor: state.bgcolor,
          mode: state.mode,
          hasErrors: this.graph?.getNodeById(state.id)?.has_errors,
          executionState:
            nodeProgressStates[createNodeLocatorId(null, state.id)]?.state ??
            null
        }
      ]
    })
  }

  /**
   * Membership stays with the viewed graph while geometry comes from the store,
   * mirroring {@link getNodes}. Group ids are root-scoped — subgraphs share the
   * root graph's `state`, so the flat store map cannot mix two live groups up.
   */
  override getGroups(): MinimapGroupData[] {
    const graph = this.graph
    const groups = graph?._groups
    if (!graph || !groups?.length) return []

    const layouts = layoutStore.getAllGroups(graph.rootGraph.id).value
    return groups.flatMap((group): MinimapGroupData[] => {
      const layout = layouts.get(group.id)
      if (!layout) return []

      return [
        {
          x: layout.position.x,
          y: layout.position.y,
          width: layout.size.width,
          height: layout.size.height,
          color: group.color
        }
      ]
    })
  }

  getNodeCount(): number {
    return this.getNodes().length
  }

  hasData(): boolean {
    return this.getNodeCount() > 0
  }
}
