import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'

// Mock dependencies
vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => false)
  }))
}))

import { useExecutionErrorStore } from './executionErrorStore'

describe('executionErrorStore — missing node operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setMissingNodeTypes', () => {
    it('sets missingNodesError with provided types', () => {
      const store = useExecutionErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      store.setMissingNodeTypes(types)

      expect(store.missingNodesError).not.toBeNull()
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.hasMissingNodes).toBe(true)
    })

    it('clears missingNodesError when given empty array', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])
      expect(store.missingNodesError).not.toBeNull()

      store.setMissingNodeTypes([])
      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('deduplicates string entries by value', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        'NodeA',
        'NodeA',
        'NodeB'
      ] as MissingNodeType[])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by nodeId when present', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false }
      ])

      // Same nodeId='1' deduplicated, nodeId='2' kept
      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by type when nodeId is absent', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', isReplaceable: false },
        { type: 'NodeA', isReplaceable: true }
      ] as MissingNodeType[])

      // Same type, no nodeId → deduplicated
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('keeps distinct nodeIds even when type is the same', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeA', nodeId: '3', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(3)
    })
  })

  describe('removeMissingNodesByType', () => {
    it('removes matching types from the missing nodes list', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false },
        { type: 'NodeC', nodeId: '3', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA', 'NodeC'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      const remaining = store.missingNodesError?.nodeTypes[0]
      expect(typeof remaining !== 'string' && remaining?.type).toBe('NodeB')
    })

    it('clears missingNodesError when all types are removed', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA'])

      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('does nothing when missingNodesError is null', () => {
      const store = useExecutionErrorStore()
      expect(store.missingNodesError).toBeNull()

      // Should not throw
      store.removeMissingNodesByType(['NodeA'])
      expect(store.missingNodesError).toBeNull()
    })

    it('does nothing when removing non-existent types', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NonExistent'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('handles removing from string entries', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        'StringNodeA',
        'StringNodeB'
      ] as MissingNodeType[])

      store.removeMissingNodesByType(['StringNodeA'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })
  })
})
