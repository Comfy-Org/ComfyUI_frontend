import { defineStore } from 'pinia'
import type { SubgraphIONode } from '@comfyorg/graph-model/entityRegistry'

interface SubgraphIoLayout {
  offsetX: number
  width: number
  height: number
  slotCenters: readonly number[]
}

export const useSubgraphIoLayoutStore = defineStore('subgraphIoLayout', () => {
  const measurements = new WeakMap<SubgraphIONode, SubgraphIoLayout>()

  return {
    measurementOf: (ioNode: SubgraphIONode) => measurements.get(ioNode),
    report(ioNode: SubgraphIONode, layout: SubgraphIoLayout) {
      measurements.set(ioNode, layout)
    },
    clear(ioNode: SubgraphIONode) {
      measurements.delete(ioNode)
    }
  }
})
