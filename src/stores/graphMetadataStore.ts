import { defineStore } from 'pinia'
import { ref, shallowReactive } from 'vue'

import type { LGraphConfig, LGraphExtra } from '@/lib/litegraph/src/LGraph'
import type { UUID } from '@/utils/uuid'

interface GraphMetadata {
  revision: number
  config: LGraphConfig
  extra: LGraphExtra
}

export const useGraphMetadataStore = defineStore('graphMetadata', () => {
  const metadata = ref(new Map<UUID, GraphMetadata>())

  function get(graphId: UUID): GraphMetadata {
    const existing = metadata.value.get(graphId)
    if (existing) return existing

    const created = shallowReactive<GraphMetadata>({
      revision: 0,
      config: {},
      extra: {}
    })
    metadata.value.set(graphId, created)
    return created
  }

  function rekey(previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const existing = metadata.value.get(previousId)
    if (!existing) return
    metadata.value.delete(previousId)
    metadata.value.set(nextId, existing)
  }

  function clear(graphId: UUID): void {
    metadata.value.delete(graphId)
  }

  return { get, rekey, clear }
})
