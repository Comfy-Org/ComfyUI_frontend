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

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

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

describe('executionErrorStore — node error operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('clearSimpleNodeErrors', () => {
    it('does nothing if lastNodeErrors is null', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = null
      // Should not error
      store.clearSimpleNodeErrors('123', 'widgetName')
      expect(store.lastNodeErrors).toBeNull()
    })

    it('clears entirely if there are only simple errors for the same slot', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'testSlot' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123', 'testSlot')

      // Should be entirely removed (empty object becomes null)
      expect(store.lastNodeErrors).toBeNull()
    })

    it('clears only the specific slot errors, leaving other errors alone', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'testSlot' }
            },
            {
              type: 'required_input_missing',
              message: 'Missing',
              details: '',
              extra_info: { input_name: 'otherSlot' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123', 'testSlot')

      // otherSlot error should still exist
      expect(store.lastNodeErrors).not.toBeNull()
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
      expect(
        store.lastNodeErrors?.['123'].errors[0].extra_info?.input_name
      ).toBe('otherSlot')
    })

    it('does not clear if the error is not simple', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'exception_type', // Complex error
              message: 'Failed execution',
              details: '',
              extra_info: { input_name: 'testSlot' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123', 'testSlot')

      // Error should remain
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })
  })

  describe('clearSimpleWidgetErrorIfValid', () => {
    it('clears error if value is valid (isValueStillOutOfRange is false)', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: '...',
              details: '',
              extra_info: { input_name: 'testWidget' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      // Valid value (5 < 10)
      store.clearSimpleWidgetErrorIfValid('123', 'testWidget', 5, { max: 10 })

      expect(store.lastNodeErrors).toBeNull()
    })

    it('does not clear error if value is still out of range', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: '...',
              details: '',
              extra_info: { input_name: 'testWidget' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      // Invalid value (15 > 10)
      store.clearSimpleWidgetErrorIfValid('123', 'testWidget', 15, { max: 10 })

      expect(store.lastNodeErrors).not.toBeNull()
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })
  })
})
