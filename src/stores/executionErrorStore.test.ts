import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { MissingNodeType } from '@/types/comfy'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import type { ExecutionErrorWsMessage, PromptError } from '@/schemas/apiSchema'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { NodeLocatorId } from '@/types/nodeIdentification'

// Mock dependencies
vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const mockShowErrorsTab = vi.hoisted(() => ({ value: false }))
const {
  mockApp,
  mockCanvasStore,
  mockExecutionIdToNodeLocatorId,
  mockGetExecutionIdByNode,
  mockGetNodeByExecutionId,
  mockWorkflowStore
} = vi.hoisted(() => ({
  mockApp: {
    isGraphReady: true,
    rootGraph: {}
  },
  mockCanvasStore: {
    currentGraph: undefined as object | undefined
  },
  mockExecutionIdToNodeLocatorId: vi.fn(
    (_rootGraph: unknown, id: string): NodeLocatorId | undefined =>
      id as NodeLocatorId
  ),
  mockGetExecutionIdByNode: vi.fn(),
  mockGetNodeByExecutionId: vi.fn(),
  mockWorkflowStore: {
    nodeLocatorIdToNodeId: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({ app: mockApp }))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: (
    ...args: Parameters<typeof mockExecutionIdToNodeLocatorId>
  ) => mockExecutionIdToNodeLocatorId(...args),
  forEachNode: vi.fn(),
  getExecutionIdByNode: (
    ...args: Parameters<typeof mockGetExecutionIdByNode>
  ) => mockGetExecutionIdByNode(...args),
  getNodeByExecutionId: (
    ...args: Parameters<typeof mockGetNodeByExecutionId>
  ) => mockGetNodeByExecutionId(...args)
}))

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
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { toNodeId } from '@/types/nodeId'
import {
  createRequiredInputMissingNodeError,
  seedRequiredInputMissingNodeError
} from '@/utils/__tests__/executionErrorTestUtils'

beforeEach(() => {
  mockShowErrorsTab.value = false
  mockApp.isGraphReady = true
  mockCanvasStore.currentGraph = undefined
  mockExecutionIdToNodeLocatorId.mockImplementation(
    (_rootGraph: unknown, id: string) => id as NodeLocatorId
  )
  mockGetExecutionIdByNode.mockReset()
  mockGetNodeByExecutionId.mockReset()
  mockWorkflowStore.nodeLocatorIdToNodeId.mockImplementation(
    (locator: NodeLocatorId) =>
      toNodeId(String(locator).split(':').at(-1) ?? locator)
  )
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
      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'widgetName'
      )
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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(999)]),
        'testSlot'
      )

      // Original error should remain untouched
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })

    it('does nothing when the requested slot has no errors', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'value_bigger_than_max',
              message: 'Max exceeded',
              details: '',
              extra_info: { input_name: 'otherSlot' }
            }
          ],
          dependent_outputs: [],
          class_type: 'TestNode'
        }
      }

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'steps'
      )

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

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(123)]))

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

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(123)]))

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

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

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
      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testWidget',
        'testWidget',
        5,
        {
          max: 10
        }
      )

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

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'sampler',
        'sampler',
        'euler_a'
      )

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
      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testWidget',
        'testWidget',
        15,
        {
          max: 10
        }
      )

      expect(store.lastNodeErrors).not.toBeNull()
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })

    it('keeps numeric range errors when no range options prove them valid', () => {
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

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testWidget',
        'testWidget',
        15
      )

      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })

    it('is a no-op when the target execution id has no node error entry', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '999': {
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

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testWidget',
        'testWidget',
        15,
        { max: 10 }
      )

      expect(store.lastNodeErrors?.['123']).toBeUndefined()
      expect(store.lastNodeErrors?.['999'].errors).toHaveLength(1)
    })
  })

  describe('startup clearing', () => {
    it('clears execution-start errors and closes the overlay when node errors are empty', () => {
      const store = useExecutionErrorStore()
      store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
        node_id: '1'
      })
      store.lastPromptError = fromPartial<PromptError>({
        message: 'prompt failed'
      })
      store.lastNodeErrors = {}
      store.showErrorOverlay()

      store.clearExecutionStartErrors()

      expect(store.lastExecutionError).toBeNull()
      expect(store.lastPromptError).toBeNull()
      expect(store.isErrorOverlayOpen).toBe(false)
    })

    it('keeps the overlay open when node errors remain after execution start', () => {
      const store = useExecutionErrorStore()
      store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
        node_id: '1'
      })
      store.lastPromptError = fromPartial<PromptError>({
        message: 'prompt failed'
      })
      seedRequiredInputMissingNodeError(
        store,
        createNodeExecutionId([toNodeId(1)]),
        'x'
      )
      store.showErrorOverlay()

      store.clearExecutionStartErrors()

      expect(store.isErrorOverlayOpen).toBe(true)
    })
  })
})

describe('executionErrorStore derived graph state', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('derives execution error node ids through locator mapping', () => {
    const store = useExecutionErrorStore()
    mockExecutionIdToNodeLocatorId.mockReturnValue('graph:7' as NodeLocatorId)
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '7'
    })

    expect(store.lastExecutionErrorNodeId).toBe(toNodeId(7))
  })

  it('returns null when there is no execution error locator', () => {
    const store = useExecutionErrorStore()
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '7'
    })
    mockExecutionIdToNodeLocatorId.mockReturnValue(undefined)

    expect(store.lastExecutionErrorNodeId).toBeNull()
  })

  it('returns null when there is no execution error', () => {
    const store = useExecutionErrorStore()

    expect(store.lastExecutionErrorNodeId).toBeNull()
  })

  it('combines prompt, node, execution, and missing-node error counts', () => {
    const store = useExecutionErrorStore()
    const missingNodesStore = useMissingNodesErrorStore()
    store.lastPromptError = fromPartial<PromptError>({
      message: 'prompt failed'
    })
    Reflect.set(store, 'lastExecutionError', { node_id: null })
    const nodeError = createRequiredInputMissingNodeError('x')
    store.lastNodeErrors = {
      '1': {
        ...nodeError,
        errors: [
          ...nodeError.errors,
          {
            type: 'value_bigger_than_max',
            message: 'Too large',
            details: '',
            extra_info: { input_name: 'y' }
          }
        ]
      }
    }
    missingNodesStore.setMissingNodeTypes([
      { type: 'MissingNode', hint: '' }
    ] as MissingNodeType[])

    expect(store.hasPromptError).toBe(true)
    expect(store.hasNodeError).toBe(true)
    expect(store.hasExecutionError).toBe(true)
    expect(store.hasAnyError).toBe(true)
    expect(store.allErrorExecutionIds).toEqual(['1'])
    expect(store.totalErrorCount).toBe(5)
  })

  it('reports empty derived state when there are no errors', () => {
    const store = useExecutionErrorStore()

    expect(store.hasNodeError).toBe(false)
    expect(store.allErrorExecutionIds).toEqual([])
    expect(store.totalErrorCount).toBe(0)
  })

  it('includes defined execution node ids in the error id list', () => {
    const store = useExecutionErrorStore()
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '2'
    })

    expect(store.allErrorExecutionIds).toEqual(['2'])
  })

  it('excludes undefined execution node ids from the error id list', () => {
    const store = useExecutionErrorStore()
    Reflect.set(store, 'lastExecutionError', { node_id: undefined })

    expect(store.allErrorExecutionIds).toEqual([])
  })

  it('collects active graph node ids for validation and execution errors', () => {
    const store = useExecutionErrorStore()
    const activeGraph = {}
    mockCanvasStore.currentGraph = activeGraph
    mockGetNodeByExecutionId.mockImplementation((_rootGraph, id: string) => ({
      id: toNodeId(id),
      graph: activeGraph
    }))
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([toNodeId(1)]),
      'x'
    )
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '2'
    })

    expect([...store.activeGraphErrorNodeIds].sort()).toEqual(['1', '2'])
  })

  it('falls back to the root graph when there is no current canvas graph', () => {
    const store = useExecutionErrorStore()
    mockCanvasStore.currentGraph = undefined
    mockGetNodeByExecutionId.mockReturnValue({
      id: toNodeId(1),
      graph: mockApp.rootGraph
    })
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([toNodeId(1)]),
      'x'
    )

    expect([...store.activeGraphErrorNodeIds]).toEqual(['1'])
  })

  it('ignores graph errors outside the active graph', () => {
    const store = useExecutionErrorStore()
    const activeGraph = {}
    mockCanvasStore.currentGraph = activeGraph
    mockGetNodeByExecutionId.mockReturnValue({
      id: toNodeId(1),
      graph: {}
    })
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([toNodeId(1)]),
      'x'
    )
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '1'
    })

    expect(store.activeGraphErrorNodeIds.size).toBe(0)
  })

  it('returns no active graph node ids before the graph is ready', () => {
    const store = useExecutionErrorStore()
    mockApp.isGraphReady = false
    store.lastExecutionError = fromPartial<ExecutionErrorWsMessage>({
      node_id: '2'
    })

    expect(store.activeGraphErrorNodeIds.size).toBe(0)
  })

  it('maps node errors by locator and checks slots', () => {
    const store = useExecutionErrorStore()
    const nodeError = createRequiredInputMissingNodeError('x')
    mockExecutionIdToNodeLocatorId.mockImplementation((_rootGraph, id) =>
      id === 'missing' ? undefined : (`locator:${id}` as NodeLocatorId)
    )
    store.lastNodeErrors = {
      '1': nodeError,
      missing: nodeError
    }

    const locator = 'locator:1' as NodeLocatorId
    expect(store.getNodeErrors(locator)).toEqual(nodeError)
    expect(store.slotHasError(locator, 'x')).toBe(true)
    expect(store.slotHasError(locator, 'y')).toBe(false)
    expect(
      store.getNodeErrors('locator:missing' as NodeLocatorId)
    ).toBeUndefined()
  })

  it('returns no slot error when there are no node errors', () => {
    const store = useExecutionErrorStore()

    expect(store.slotHasError('locator:1' as NodeLocatorId, 'x')).toBe(false)
  })

  it('detects container nodes with internal errors', () => {
    const store = useExecutionErrorStore()
    const node = fromPartial<LGraphNode>({})
    mockGetExecutionIdByNode.mockReturnValueOnce(undefined)

    expect(store.isContainerWithInternalError(node)).toBe(false)

    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([toNodeId(1), toNodeId(2)]),
      'x'
    )
    mockGetExecutionIdByNode.mockReturnValue(
      createNodeExecutionId([toNodeId(1)])
    )

    expect(store.isContainerWithInternalError(node)).toBe(true)
  })

  it('does not report container errors before the graph is ready', () => {
    const store = useExecutionErrorStore()
    mockApp.isGraphReady = false

    expect(
      store.isContainerWithInternalError(fromPartial<LGraphNode>({}))
    ).toBe(false)
  })
})

describe('surfaceMissingModels — silent option', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockShowErrorsTab.value = true
  })

  it('opens error overlay when silent is not specified and setting is enabled', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingModels([
      fromPartial<MissingModelCandidate>({
        name: 'model.safetensors',
        nodeId: toNodeId('1'),
        nodeType: 'Loader',
        widgetName: 'ckpt',
        isMissing: true,
        isAssetSupported: false
      })
    ])

    expect(store.isErrorOverlayOpen).toBe(true)
  })

  it('opens error overlay when silent is false and setting is enabled', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingModels(
      [
        fromPartial<MissingModelCandidate>({
          name: 'model.safetensors',
          nodeId: toNodeId('1'),
          nodeType: 'Loader',
          widgetName: 'ckpt',
          isMissing: true,
          isAssetSupported: false
        })
      ],
      { silent: false }
    )

    expect(store.isErrorOverlayOpen).toBe(true)
  })

  it('does NOT open error overlay when silent is true', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingModels(
      [
        fromPartial<MissingModelCandidate>({
          name: 'model.safetensors',
          nodeId: toNodeId('1'),
          nodeType: 'Loader',
          widgetName: 'ckpt',
          isMissing: true,
          isAssetSupported: false
        })
      ],
      { silent: true }
    )

    expect(store.isErrorOverlayOpen).toBe(false)
  })

  it('does NOT open error overlay for empty models even without silent', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingModels([])

    expect(store.isErrorOverlayOpen).toBe(false)
  })

  it('does NOT open error overlay when the setting is disabled', () => {
    const store = useExecutionErrorStore()
    mockShowErrorsTab.value = false
    store.surfaceMissingModels([
      fromPartial<MissingModelCandidate>({
        name: 'model.safetensors',
        nodeId: toNodeId('1'),
        nodeType: 'Loader',
        widgetName: 'ckpt',
        isMissing: true,
        isAssetSupported: false
      })
    ])

    expect(store.isErrorOverlayOpen).toBe(false)
  })
})

describe('surfaceMissingMedia — silent option', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockShowErrorsTab.value = true
  })

  it('opens error overlay when silent is not specified and setting is enabled', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingMedia([
      fromPartial<MissingMediaCandidate>({
        name: 'photo.png',
        nodeId: toNodeId('1'),
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        isMissing: true
      })
    ])

    expect(store.isErrorOverlayOpen).toBe(true)
  })

  it('opens error overlay when silent is false and setting is enabled', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingMedia(
      [
        fromPartial<MissingMediaCandidate>({
          name: 'photo.png',
          nodeId: toNodeId('1'),
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          isMissing: true
        })
      ],
      { silent: false }
    )

    expect(store.isErrorOverlayOpen).toBe(true)
  })

  it('does NOT open error overlay when silent is true', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingMedia(
      [
        fromPartial<MissingMediaCandidate>({
          name: 'photo.png',
          nodeId: toNodeId('1'),
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          isMissing: true
        })
      ],
      { silent: true }
    )

    expect(store.isErrorOverlayOpen).toBe(false)
  })

  it('does NOT open error overlay for empty media even without silent', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingMedia([])

    expect(store.isErrorOverlayOpen).toBe(false)
  })

  it('does NOT open error overlay when the setting is disabled', () => {
    const store = useExecutionErrorStore()
    mockShowErrorsTab.value = false
    store.surfaceMissingMedia([
      fromPartial<MissingMediaCandidate>({
        name: 'photo.png',
        nodeId: toNodeId('1'),
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        isMissing: true
      })
    ])

    expect(store.isErrorOverlayOpen).toBe(false)
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
    ] as MissingNodeType[])
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
