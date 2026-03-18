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

const mockShowErrorsTab = vi.hoisted(() => ({ value: false }))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => mockShowErrorsTab.value)
  }))
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => mockShowErrorsTab.value)
  }))
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

import { useExecutionErrorStore } from './executionErrorStore'
import { useMissingNodesErrorStore } from './missingNodesErrorStore'

describe('executionErrorStore — missing node operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setMissingNodeTypes', () => {
    it('sets missingNodesError with provided types', () => {
      const store = useMissingNodesErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      store.setMissingNodeTypes(types)

      expect(store.missingNodesError).not.toBeNull()
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.hasMissingNodes).toBe(true)
    })

    it('clears missingNodesError when given empty array', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])
      expect(store.missingNodesError).not.toBeNull()

      store.setMissingNodeTypes([])
      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('deduplicates string entries by value', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        'NodeA',
        'NodeA',
        'NodeB'
      ] as MissingNodeType[])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by nodeId when present', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false }
      ])

      // Same nodeId='1' deduplicated, nodeId='2' kept
      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by type when nodeId is absent', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', isReplaceable: false },
        { type: 'NodeA', isReplaceable: true }
      ] as MissingNodeType[])

      // Same type, no nodeId → deduplicated
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('keeps distinct nodeIds even when type is the same', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeA', nodeId: '3', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(3)
    })
  })

  describe('surfaceMissingNodes', () => {
    beforeEach(() => {
      mockShowErrorsTab.value = false
    })

    it('stores missing node types when called', () => {
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      missingNodesStore.surfaceMissingNodes(types, () =>
        executionErrorStore.showErrorOverlay()
      )

      expect(missingNodesStore.missingNodesError).not.toBeNull()
      expect(missingNodesStore.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(missingNodesStore.hasMissingNodes).toBe(true)
    })

    it('opens error overlay when ShowErrorsTab setting is true', () => {
      mockShowErrorsTab.value = true
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.surfaceMissingNodes(
        [{ type: 'NodeA', nodeId: '1', isReplaceable: false }],
        () => executionErrorStore.showErrorOverlay()
      )

      expect(executionErrorStore.isErrorOverlayOpen).toBe(true)
    })

    it('does not open error overlay when ShowErrorsTab setting is false', () => {
      mockShowErrorsTab.value = false
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.surfaceMissingNodes(
        [{ type: 'NodeA', nodeId: '1', isReplaceable: false }],
        () => executionErrorStore.showErrorOverlay()
      )

      expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
    })

    it('deduplicates node types', () => {
      const missingNodesStore = useMissingNodesErrorStore()
      const executionErrorStore = useExecutionErrorStore()
      missingNodesStore.surfaceMissingNodes(
        [
          { type: 'NodeA', nodeId: '1', isReplaceable: false },
          { type: 'NodeA', nodeId: '1', isReplaceable: false },
          { type: 'NodeB', nodeId: '2', isReplaceable: false }
        ],
        () => executionErrorStore.showErrorOverlay()
      )

      expect(missingNodesStore.missingNodesError?.nodeTypes).toHaveLength(2)
    })
  })

  describe('removeMissingNodesByType', () => {
    it('removes matching types from the missing nodes list', () => {
      const store = useMissingNodesErrorStore()
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
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA'])

      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('does nothing when missingNodesError is null', () => {
      const store = useMissingNodesErrorStore()
      expect(store.missingNodesError).toBeNull()

      // Should not throw
      store.removeMissingNodesByType(['NodeA'])
      expect(store.missingNodesError).toBeNull()
    })

    it('does nothing when removing non-existent types', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NonExistent'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('handles removing from string entries', () => {
      const store = useMissingNodesErrorStore()
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

    it('does nothing if executionId is not found in lastNodeErrors', () => {
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

      store.clearSimpleNodeErrors('999', 'testSlot')

      // Original error should remain untouched
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })

    it('preserves complex errors when slot has both simple and complex errors', () => {
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
              type: 'exception_type',
              message: 'Runtime error',
              details: '',
              extra_info: { input_name: 'testSlot' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123', 'testSlot')

      // Mixed simple+complex: not all are simple, so none are cleared
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(2)
    })

    it('clears one node while preserving another in multi-node errors', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'steps' }
            }
          ],
          dependent_outputs: [],
          class_type: 'KSampler'
        },
        '456': {
          errors: [
            {
              type: 'exception_type',
              message: 'Runtime failure',
              details: '',
              extra_info: { input_name: 'model' }
            }
          ],
          dependent_outputs: [],
          class_type: 'LoadModel'
        }
      }

      store.clearSimpleNodeErrors('123', 'steps')

      // Node 123 cleared, node 456 remains
      expect(store.lastNodeErrors?.['123']).toBeUndefined()
      expect(store.lastNodeErrors?.['456'].errors).toHaveLength(1)
    })

    it('clears entire node when no slotName and all errors are simple', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'steps' }
            },
            {
              type: 'required_input_missing',
              message: 'Missing',
              details: '',
              extra_info: { input_name: 'model' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123')

      expect(store.lastNodeErrors).toBeNull()
    })

    it('does not clear when no slotName and some errors are not simple', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'steps' }
            },
            {
              type: 'exception_type',
              message: 'Runtime error',
              details: '',
              extra_info: { input_name: 'model' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors('123')

      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(2)
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

  describe('clearWidgetRelatedErrors', () => {
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
      store.clearWidgetRelatedErrors('123', 'testWidget', 'testWidget', 5, {
        max: 10
      })

      expect(store.lastNodeErrors).toBeNull()
    })

    it('optimistically clears value_not_in_list error for string combo values', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_not_in_list',
              message: 'Value not in list',
              details: '',
              extra_info: { input_name: 'sampler' }
            }
          ],
          dependent_outputs: [],
          class_type: 'KSampler'
        }
      }

      store.clearWidgetRelatedErrors('123', 'sampler', 'sampler', 'euler_a')

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
      store.clearWidgetRelatedErrors('123', 'testWidget', 'testWidget', 15, {
        max: 10
      })

      expect(store.lastNodeErrors).not.toBeNull()
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })
  })
})

describe('clearAllErrors', () => {
  let executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  let missingNodesStore: ReturnType<typeof useMissingNodesErrorStore>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    executionErrorStore = useExecutionErrorStore()
    missingNodesStore = useMissingNodesErrorStore()
  })

  it('resets all error categories and closes error overlay', () => {
    executionErrorStore.lastExecutionError = {
      prompt_id: 'test',
      timestamp: 0,
      node_id: '1',
      node_type: 'Test',
      executed: [],
      exception_message: 'fail',
      exception_type: 'RuntimeError',
      traceback: []
    }
    executionErrorStore.lastPromptError = {
      type: 'execution',
      message: 'fail',
      details: ''
    }
    executionErrorStore.lastNodeErrors = {
      '1': {
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 'x' }
          }
        ],
        dependent_outputs: [],
        class_type: 'Test'
      }
    }
    missingNodesStore.setMissingNodeTypes([
      { type: 'MissingNode', hint: '' }
    ] as unknown as MissingNodeType[])
    executionErrorStore.showErrorOverlay()

    executionErrorStore.clearAllErrors()

    expect(executionErrorStore.lastExecutionError).toBeNull()
    expect(executionErrorStore.lastPromptError).toBeNull()
    expect(executionErrorStore.lastNodeErrors).toBeNull()
    expect(missingNodesStore.missingNodesError).toBeNull()
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
    expect(executionErrorStore.hasAnyError).toBe(false)
  })
})
