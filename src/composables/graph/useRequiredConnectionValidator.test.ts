import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGraphErrorStateStore } from '@/stores/graphErrorStateStore'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: null
  }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: vi.fn(() => ({
    nodeDefsByName: {}
  }))
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  forEachNode: vi.fn()
}))

describe('useRequiredConnectionValidator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('store integration', () => {
    it('adds errors for missing required connections', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:missing:1:model',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'model' },
            code: 'MISSING_REQUIRED_INPUT'
          }
        ]
      })

      expect(store.hasSlotError('1', 'model')).toBe(true)
      expect(store.hasErrorsForNode('1')).toBe(true)
    })

    it('clears errors when connections are made', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:missing:1:model',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'model' }
          }
        ]
      })

      expect(store.hasSlotError('1', 'model')).toBe(true)

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: []
      })

      expect(store.hasSlotError('1', 'model')).toBe(false)
    })

    it('preserves backend errors when frontend errors change', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'backend',
        errors: [
          {
            key: 'backend:node:2',
            source: 'backend',
            target: { kind: 'node', nodeId: '2' }
          }
        ]
      })

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:missing:1:model',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'model' }
          }
        ]
      })

      expect(store.hasErrorsForNode('1')).toBe(true)
      expect(store.hasErrorsForNode('2')).toBe(true)

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: []
      })

      expect(store.hasErrorsForNode('1')).toBe(false)
      expect(store.hasErrorsForNode('2')).toBe(true)
    })
  })
})
