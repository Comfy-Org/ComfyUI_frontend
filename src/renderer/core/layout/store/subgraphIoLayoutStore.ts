import { defineStore, getActivePinia } from 'pinia'
import { reactive } from 'vue'

import { provideSubgraphIoLayout } from '@/lib/litegraph/src/subgraph/subgraphIoLayout'
import type { SubgraphIoLayout } from '@/lib/litegraph/src/subgraph/subgraphIoLayout'

export const useSubgraphIoLayoutStore = defineStore('subgraphIoLayout', () => {
  const measurements = reactive(new Map<string, SubgraphIoLayout>())
  return { measurements }
})

provideSubgraphIoLayout((graphId, nodeId) => {
  const pinia = getActivePinia()
  return pinia
    ? useSubgraphIoLayoutStore(pinia).measurements.get(`${graphId}:${nodeId}`)
    : undefined
})
