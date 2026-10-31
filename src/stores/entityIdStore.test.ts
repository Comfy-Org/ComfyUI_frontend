import { computed } from 'vue'
import { describe } from 'vitest'

import { mintNodeId } from '@comfyorg/litegraph/idAllocation'
import { createLGraphState } from '@comfyorg/graph-model/lgraphState'
import { test } from '@/testing/pinia'
import type { UUID } from '@comfyorg/graph-model/uuid'

import { useEntityIdStore } from '@comfyorg/graph-state/entityIdStore'

describe(useEntityIdStore, { tags: ['concurrent-safe'] }, () => {
  const first = '00000000-0000-4000-8000-000000000001' as UUID
  const second = '00000000-0000-4000-8000-000000000002' as UUID

  test('keeps allocation state when a root graph is rekeyed', ({
    pinia,
    expect
  }) => {
    const store = useEntityIdStore(pinia)
    const state = store.get(first)
    mintNodeId(state, 'sequential', new Set())

    store.rekey(first, second)

    expect(store.get(second)).toBe(state)
    expect(Number(mintNodeId(store.get(second), 'sequential', new Set()))).toBe(
      2
    )
  })

  test('replaces compatibility state without sharing the caller object', ({
    pinia,
    expect
  }) => {
    const store = useEntityIdStore(pinia)
    const state = createLGraphState()
    state.lastNodeId = 2

    store.set(first, state)
    state.lastNodeId = 99

    expect(store.get(first).lastNodeId).toBe(2)
  })

  test('reacts to in-place map mutations', ({ pinia, expect }) => {
    const store = useEntityIdStore(pinia)
    const hasFirst = computed(() => store.has(first))

    expect(hasFirst.value).toBe(false)
    store.get(first)
    expect(hasFirst.value).toBe(true)
    store.clear(first)
    expect(hasFirst.value).toBe(false)
  })
})
