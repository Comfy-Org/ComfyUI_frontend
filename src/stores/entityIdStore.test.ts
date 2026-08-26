import { describe, expect, it } from 'vitest'

import { createLGraphState, mintNodeId } from '@/lib/litegraph/src/idAllocation'
import type { UUID } from '@/utils/uuid'

import { useEntityIdStore } from './entityIdStore'

describe(useEntityIdStore, () => {
  const first = '00000000-0000-4000-8000-000000000001' as UUID
  const second = '00000000-0000-4000-8000-000000000002' as UUID

  it('keeps allocation state when a root graph is rekeyed', () => {
    const store = useEntityIdStore()
    const state = store.get(first)
    mintNodeId(state)

    store.rekey(first, second)

    expect(store.get(second)).toBe(state)
    expect(Number(mintNodeId(store.get(second)))).toBe(2)
  })

  it('replaces compatibility state without sharing the caller object', () => {
    const store = useEntityIdStore()
    const state = createLGraphState()
    state.lastNodeId = 2

    store.set(first, state)
    state.lastNodeId = 99

    expect(store.get(first).lastNodeId).toBe(2)
  })
})
