import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import { useOnboardingTourStore } from './onboardingTourStore'

describe('onboardingTourStore', () => {
  let store: ReturnType<typeof useOnboardingTourStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useOnboardingTourStore()
  })

  it('reset() clears all state back to idle', () => {
    store.phase = 'active'
    store.stepIndex = 3
    store.resolvedRoles = {
      source: null,
      prompt: null,
      engine: null,
      sink: null,
      mediaKind: 'video'
    }
    store.revealedNodeIds.add(toNodeId(42))
    store.resultMedia = { url: 'blob:x', kind: 'image' }
    store.runStatus = 'running'

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.stepIndex).toBe(0)
    expect(store.resolvedRoles).toBeNull()
    expect(store.revealedNodeIds.size).toBe(0)
    expect(store.resultMedia).toBeNull()
    expect(store.runStatus).toBe('idle')
  })
})
