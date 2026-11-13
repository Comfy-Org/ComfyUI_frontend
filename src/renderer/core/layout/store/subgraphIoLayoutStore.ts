import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@comfyorg/graph-model/uuid'

interface SubgraphIoLayout {
  offsetX: number
  width: number
  height: number
  slotCenters: readonly number[]
}

export const useSubgraphIoLayoutStore = defineStore('subgraphIoLayout', () => {
  const measurements = reactive(new Map<string, SubgraphIoLayout>())
  const keyOf = (graphId: UUID, nodeId: NodeId) => `${graphId}:${nodeId}`

  return {
    measurementOf: (graphId: UUID, nodeId: NodeId) =>
      measurements.get(keyOf(graphId, nodeId)),
    report(graphId: UUID, nodeId: NodeId, layout: SubgraphIoLayout) {
      measurements.set(keyOf(graphId, nodeId), layout)
    },
    clear(graphId: UUID, nodeId: NodeId) {
      measurements.delete(keyOf(graphId, nodeId))
    }
  }
})
