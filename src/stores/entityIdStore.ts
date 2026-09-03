import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import {
  cloneLGraphState,
  createLGraphState
} from '@/lib/litegraph/src/idAllocation'
import type { LGraphState } from '@/lib/litegraph/src/idAllocation'
import type { UUID } from '@/utils/uuid'

export const useEntityIdStore = defineStore('entityId', () => {
  const states = shallowReactive(new Map<UUID, LGraphState>())

  function get(rootGraphId: UUID): LGraphState {
    const existing = states.get(rootGraphId)
    if (existing) return existing

    const created = createLGraphState()
    states.set(rootGraphId, created)
    return created
  }

  function set(rootGraphId: UUID, state: LGraphState): void {
    states.set(rootGraphId, cloneLGraphState(state))
  }

  function rekey(previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const existing = states.get(previousId)
    if (!existing) return
    states.delete(previousId)
    states.set(nextId, existing)
  }

  function has(rootGraphId: UUID): boolean {
    return states.has(rootGraphId)
  }

  function clear(rootGraphId: UUID): void {
    states.delete(rootGraphId)
  }

  return { get, has, set, rekey, clear }
})
