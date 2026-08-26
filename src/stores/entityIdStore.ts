import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { createLGraphState } from '@/lib/litegraph/src/idAllocation'
import type { LGraphState } from '@/lib/litegraph/src/idAllocation'
import type { UUID } from '@/utils/uuid'

export const useEntityIdStore = defineStore('entityId', () => {
  const states = shallowRef(new Map<UUID, LGraphState>())

  function get(rootGraphId: UUID): LGraphState {
    const existing = states.value.get(rootGraphId)
    if (existing) return existing

    const created = createLGraphState()
    states.value.set(rootGraphId, created)
    return created
  }

  function set(rootGraphId: UUID, state: LGraphState): void {
    states.value.set(rootGraphId, { ...state })
  }

  function rekey(previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const existing = states.value.get(previousId)
    if (!existing) return
    states.value.delete(previousId)
    states.value.set(nextId, existing)
  }

  function has(rootGraphId: UUID): boolean {
    return states.value.has(rootGraphId)
  }

  function clear(rootGraphId: UUID): void {
    states.value.delete(rootGraphId)
  }

  return { get, has, set, rekey, clear }
})
