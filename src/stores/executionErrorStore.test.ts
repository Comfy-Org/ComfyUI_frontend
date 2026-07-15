import { fromAny } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import type { MissingNodeType } from '@/types/comfy'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'

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
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { toNodeId } from '@/types/nodeId'

function mockGraphReady(rootGraph: typeof app.rootGraph) {
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
  vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)
}

describe('executionErrorStore — node error operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    it('clears a lifted host slot error from the raw interior record', () => {
      const { rootGraph } = createBoundaryLinkedSubgraph()
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '12:5': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      }

      expect(store.surfacedNodeErrors).toHaveProperty('12')

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(12)]), 'seed')

      expect(store.lastNodeErrors).toBeNull()
      expect(store.surfacedNodeErrors).toBeNull()
    })

    it('does not clear lifted host slot errors when the raw error is not simple', () => {
      const { rootGraph } = createBoundaryLinkedSubgraph()
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '12:5': nodeError([
          validationError(
            'custom_validation_failed',
            'seed_input',
            {},
            'Custom validation failed'
          )
        ])
      }

      expect(store.surfacedNodeErrors).toHaveProperty('12')

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(12)]), 'seed')

      expect(store.lastNodeErrors).toHaveProperty('12:5')
      expect(store.lastNodeErrors?.['12:5'].errors).toHaveLength(1)
    })

    it('clears a nested lifted error fixed at an intermediate host level', () => {
      const rootGraph = createTestRootGraph()
      const outerSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'seed', type: '*' }]
      })
      const outerHost = createTestSubgraphNode(outerSubgraph, { id: 1 })
      rootGraph.add(outerHost)

      const middleSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'seed', type: '*' }]
      })
      const middleHost = createTestSubgraphNode(middleSubgraph, {
        id: 2,
        parentGraph: outerSubgraph
      })
      outerSubgraph.add(middleHost)
      outerSubgraph.inputNode.slots[0].connect(middleHost.inputs[0], middleHost)

      const leaf = new LGraphNode('LeafNode')
      leaf.id = toNodeId(3)
      const leafInput = leaf.addInput('seed_input', '*')
      middleSubgraph.add(leaf)
      middleSubgraph.inputNode.slots[0].connect(leafInput, leaf)
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '1:2:3': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      }

      expect(store.surfacedNodeErrors).toHaveProperty('1')

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(1), toNodeId(2)]),
        'seed'
      )

      expect(
        store.lastNodeErrors,
        'a fix at the intermediate host clears the raw interior error'
      ).toBeNull()
      expect(store.surfacedNodeErrors).toBeNull()
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

    it('validates the base target against live widget bounds, not recorded ones', () => {
      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '123': nodeError([
          validationError('value_bigger_than_max', 'testWidget', {
            input_config: ['INT', { max: 100 }]
          })
        ])
      }

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testWidget',
        'testWidget',
        150,
        { max: 200 }
      )

      expect(
        store.lastNodeErrors,
        'a value within the refreshed widget bounds clears despite stale recorded bounds'
      ).toBeNull()
    })

    it('does not clear lifted range errors until the host value is in range', () => {
      const { rootGraph } = createBoundaryLinkedSubgraph()
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '12:5': nodeError([
          validationError('value_bigger_than_max', 'seed_input', {}, 'Too high')
        ])
      }

      expect(store.surfacedNodeErrors).toHaveProperty('12')

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(12)]),
        'seed',
        'seed',
        200,
        { max: 100 }
      )

      expect(store.lastNodeErrors).toHaveProperty('12:5')
      expect(store.lastNodeErrors?.['12:5'].errors).toHaveLength(1)

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(12)]),
        'seed',
        'seed',
        50,
        { max: 100 }
      )

      expect(store.lastNodeErrors).toBeNull()
    })

    it('clears fan-out lifted targets per their own recorded bounds', () => {
      const { rootGraph, subgraph } = createBoundaryLinkedSubgraph()
      const second = new LGraphNode('SecondInterior')
      second.id = toNodeId(7)
      const secondInput = second.addInput('other_input', '*')
      subgraph.add(second)
      subgraph.inputNode.slots[0].connect(secondInput, second)
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '12:5': nodeError([
          validationError('value_bigger_than_max', 'seed_input', {
            input_config: ['INT', { max: 100 }]
          })
        ]),
        '12:7': nodeError([
          validationError('value_bigger_than_max', 'other_input', {
            input_config: ['INT', { max: 50 }]
          })
        ])
      }

      expect(store.surfacedNodeErrors?.['12'].errors).toHaveLength(2)

      store.clearWidgetRelatedErrors(
        createNodeExecutionId([toNodeId(12)]),
        'seed',
        'seed',
        75,
        { max: 100 }
      )

      expect(
        store.lastNodeErrors?.['12:5'],
        'the target whose max=100 is satisfied by 75 clears'
      ).toBeUndefined()
      expect(
        store.lastNodeErrors?.['12:7'].errors,
        'the target whose max=50 is still violated by 75 stays'
      ).toHaveLength(1)
    })
  })

  describe('surfacedNodeErrors', () => {
    it('derives boundary-lifted errors while preserving the raw record', () => {
      const { rootGraph, host } = createBoundaryLinkedSubgraph()
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.lastNodeErrors = {
        '12:5': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      }

      const hostLocatorId = createNodeLocatorId(null, toNodeId(12))

      expect(store.lastNodeErrors).toHaveProperty('12:5')
      expect(store.surfacedNodeErrors).toHaveProperty('12')
      expect(
        store.surfacedNodeErrors?.['12'].errors[0].extra_info
      ).toMatchObject({
        input_name: 'seed',
        source_execution_id: '12:5',
        source_input_name: 'seed_input'
      })
      expect(store.getNodeErrors(hostLocatorId)?.class_type).toBe(host.title)
      expect(store.allErrorExecutionIds).toEqual(['12'])
      expect(store.activeGraphErrorNodeIds).toEqual(new Set(['12']))
    })
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
      fromAny({
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
        fromAny({
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
        fromAny({
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
})

describe('surfaceMissingMedia — silent option', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockShowErrorsTab.value = true
  })

  it('opens error overlay when silent is not specified and setting is enabled', () => {
    const store = useExecutionErrorStore()
    store.surfaceMissingMedia([
      fromAny({
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
        fromAny({
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
        fromAny({
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
    missingNodesStore.setMissingNodeTypes(
      fromAny<MissingNodeType[], unknown>([{ type: 'MissingNode', hint: '' }])
    )
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
