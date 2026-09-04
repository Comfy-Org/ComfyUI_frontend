import { fromAny } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
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

const mockSettings = vi.hoisted(() => ({
  values: {
    'Comfy.RightSidePanel.ShowErrorsTab': false,
    'Comfy.Workflow.ShowMissingNodesWarning': true,
    'Comfy.Workflow.ShowMissingModelsWarning': true,
    'Comfy.Workflow.ShowMissingMediaWarning': true
  } as Record<string, boolean>
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => mockSettings.values[key])
  }))
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

import { useExecutionErrorStore } from './executionErrorStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { toNodeId } from '@/types/nodeId'

function mockGraphReady(rootGraph: typeof app.rootGraph) {
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
  vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)
}

describe('executionErrorStore — node error operations', () => {
  describe('clearSimpleNodeErrors', () => {
    it('does nothing if lastNodeErrors is null', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors(null)
      // Should not error
      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'widgetName'
      )
      expect(store.lastNodeErrors).toBeNull()
    })

    it('clears entirely if there are only simple errors for the same slot', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

      // Should be entirely removed (empty object becomes null)
      expect(store.lastNodeErrors).toBeNull()
    })

    it('clears only the specific slot errors, leaving other errors alone', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
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
      })

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(999)]),
        'testSlot'
      )

      // Original error should remain untouched
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(1)
    })

    it('preserves complex errors when slot has both simple and complex errors', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

      store.clearSimpleNodeErrors(
        createNodeExecutionId([toNodeId(123)]),
        'testSlot'
      )

      // Mixed simple+complex: not all are simple, so none are cleared
      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(2)
    })

    it('clears one node while preserving another in multi-node errors', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
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
      })

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(123)]))

      expect(store.lastNodeErrors).toBeNull()
    })

    it('does not clear when no slotName and some errors are not simple', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(123)]))

      expect(store.lastNodeErrors?.['123'].errors).toHaveLength(2)
    })

    it('does not clear if the error is not simple', () => {
      const store = useExecutionErrorStore()
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
        '12:5': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      })

      expect(store.surfacedNodeErrors).toHaveProperty('12')

      store.clearSimpleNodeErrors(createNodeExecutionId([toNodeId(12)]), 'seed')

      expect(store.lastNodeErrors).toBeNull()
      expect(store.surfacedNodeErrors).toBeNull()
    })

    it('does not clear lifted host slot errors when the raw error is not simple', () => {
      const { rootGraph } = createBoundaryLinkedSubgraph()
      mockGraphReady(rootGraph)

      const store = useExecutionErrorStore()
      store.recordNodeErrors({
        '12:5': nodeError([
          validationError(
            'custom_validation_failed',
            'seed_input',
            {},
            'Custom validation failed'
          )
        ])
      })

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
      store.recordNodeErrors({
        '1:2:3': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      })

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
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
        '123': nodeError([
          validationError('value_bigger_than_max', 'testWidget', {
            input_config: ['INT', { max: 100 }]
          })
        ])
      })

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
      store.recordNodeErrors({
        '12:5': nodeError([
          validationError('value_bigger_than_max', 'seed_input', {}, 'Too high')
        ])
      })

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
      store.recordNodeErrors({
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
      })

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
      store.recordNodeErrors({
        '12:5': nodeError([
          validationError('required_input_missing', 'seed_input')
        ])
      })

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
    mockSettings.values['Comfy.RightSidePanel.ShowErrorsTab'] = true
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

describe('surfaceMissingModels — per-kind visibility', () => {
  it('stores the models but keeps the overlay closed while the warning is off', () => {
    mockSettings.values['Comfy.RightSidePanel.ShowErrorsTab'] = true
    mockSettings.values['Comfy.Workflow.ShowMissingModelsWarning'] = false
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

    expect(useMissingModelStore().missingModelCandidates).toHaveLength(1)
    expect(store.isErrorOverlayOpen).toBe(false)
    expect(store.hasMissingError).toBe(false)
    mockSettings.values['Comfy.Workflow.ShowMissingModelsWarning'] = true
  })
})

describe('surfaceMissingMedia — silent option', () => {
  beforeEach(() => {
    mockSettings.values['Comfy.RightSidePanel.ShowErrorsTab'] = true
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

describe('recordNodeErrors', () => {
  it('normalizes an empty error record to null', () => {
    const store = useExecutionErrorStore()

    store.recordNodeErrors({})

    expect(store.lastNodeErrors).toBeNull()
  })

  it('keeps a null error record as null', () => {
    const store = useExecutionErrorStore()

    store.recordNodeErrors(null)

    expect(store.lastNodeErrors).toBeNull()
  })
})

describe('hasMissingError', () => {
  it.for([
    {
      type: 'nodes',
      seedMissingError: () => {
        useMissingNodesErrorStore().setMissingNodeTypes([
          { type: 'TestNode', hint: '' }
        ])
      }
    },
    {
      type: 'models',
      seedMissingError: () => {
        useMissingModelStore().missingModelCandidates = [fromAny({})]
      }
    },
    {
      type: 'media',
      seedMissingError: () => {
        useMissingMediaStore().missingMediaCandidates = [fromAny({})]
      }
    }
  ])('includes missing $type', ({ seedMissingError }) => {
    const executionErrorStore = useExecutionErrorStore()

    expect(executionErrorStore.hasMissingError).toBe(false)

    seedMissingError()

    expect(executionErrorStore.hasMissingError).toBe(true)
  })

  it('returns false when only node validation errors exist', () => {
    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': nodeError([validationError('required_input_missing', 'input')])
    })

    expect(executionErrorStore.hasMissingError).toBe(false)
  })
})

describe('clearRunErrors', () => {
  let executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  let missingNodesStore: ReturnType<typeof useMissingNodesErrorStore>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    executionErrorStore = useExecutionErrorStore()
    missingNodesStore = useMissingNodesErrorStore()
  })

  it('resets run errors and closes the overlay, leaving missing resources', () => {
    executionErrorStore.recordExecutionError({
      prompt_id: 'test',
      timestamp: 0,
      node_id: '1',
      node_type: 'Test',
      executed: [],
      exception_message: 'fail',
      exception_type: 'RuntimeError',
      traceback: []
    })
    executionErrorStore.recordPromptError({
      type: 'execution',
      message: 'fail',
      details: ''
    })
    executionErrorStore.recordNodeErrors({
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
    })
    missingNodesStore.setMissingNodeTypes([{ type: 'MissingNode', hint: '' }])
    executionErrorStore.showErrorOverlay()

    executionErrorStore.clearRunErrors()

    expect(executionErrorStore.lastExecutionError).toBeNull()
    expect(executionErrorStore.lastPromptError).toBeNull()
    expect(executionErrorStore.lastNodeErrors).toBeNull()
    expect(executionErrorStore.isErrorOverlayOpen).toBe(false)
    expect(missingNodesStore.missingNodesError?.nodeTypes).toEqual([
      { type: 'MissingNode', hint: '' }
    ])
    expect(executionErrorStore.hasAnyError).toBe(true)
  })
})

describe('added-node error scan coordination', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps overlapping scans isolated by graph until every scan finishes', () => {
    const store = useExecutionErrorStore()
    const graphA = createTestRootGraph()
    const graphB = createTestRootGraph()
    const executionId = createNodeExecutionId([toNodeId(1)])

    const finishFirst = store.beginAddedNodeErrorScan(graphA, executionId)
    const finishSecond = store.beginAddedNodeErrorScan(graphA, executionId)
    const finishOtherGraph = store.beginAddedNodeErrorScan(graphB, executionId)

    expect(store.hasPendingAddedNodeErrorScan(graphA, executionId)).toBe(true)
    expect(store.hasPendingAddedNodeErrorScan(graphB, executionId)).toBe(true)

    finishFirst()
    finishFirst()
    expect(store.hasPendingAddedNodeErrorScan(graphA, executionId)).toBe(true)

    finishSecond()
    expect(store.hasPendingAddedNodeErrorScan(graphA, executionId)).toBe(false)
    expect(store.hasPendingAddedNodeErrorScan(graphB, executionId)).toBe(true)

    finishOtherGraph()
    expect(store.hasPendingAddedNodeErrorScan(graphB, executionId)).toBe(false)
  })
})

describe('setActiveGraph', () => {
  const graphAId = '11111111-1111-4111-8111-111111111111'
  const graphBId = '22222222-2222-4222-8222-222222222222'

  const nodeErrors = {
    '1': nodeError(
      [validationError('value_bigger_than_max', 'steps', {}, 'Too big', '')],
      'KSampler'
    )
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('keeps each graph run errors separate and restores them on return', () => {
    const store = useExecutionErrorStore()
    const executionError = {
      prompt_id: 'graph-a-run',
      timestamp: 0,
      node_id: '1',
      node_type: 'KSampler',
      executed: [],
      exception_message: 'fail',
      exception_type: 'RuntimeError',
      traceback: []
    }
    const promptError = {
      type: 'execution',
      message: 'prompt failed',
      details: ''
    }

    store.setActiveGraph(graphAId)
    store.recordNodeErrors(nodeErrors)
    store.recordExecutionError(executionError)
    store.recordPromptError(promptError)

    store.setActiveGraph(graphBId)
    expect(store.lastNodeErrors).toBeNull()
    expect(store.lastExecutionError).toBeNull()
    expect(store.lastPromptError).toBeNull()
    expect(store.totalErrorCount).toBe(0)

    store.setActiveGraph(graphAId)
    expect(store.lastNodeErrors).toEqual(nodeErrors)
    expect(store.lastExecutionError).toEqual(executionError)
    expect(store.lastPromptError).toEqual(promptError)
    expect(store.totalErrorCount).toBe(3)
  })

  it('keeps workflows with the same graph id separate', () => {
    const store = useExecutionErrorStore()

    store.setActiveGraph(graphAId, 'workflows/a.json')
    store.recordNodeErrors(nodeErrors)

    store.setActiveGraph(graphAId, 'workflows/b.json')
    expect(store.lastNodeErrors).toBeNull()

    store.setActiveGraph(graphAId, 'workflows/a.json')
    expect(store.lastNodeErrors).toEqual(nodeErrors)
  })

  it('hides run errors while detached from a graph', () => {
    const store = useExecutionErrorStore()

    store.setActiveGraph(graphAId)
    store.recordNodeErrors(nodeErrors)

    store.setActiveGraph(null)
    expect(store.lastNodeErrors).toBeNull()
    expect(store.hasAnyError).toBe(false)

    store.setActiveGraph(graphAId)
    expect(store.lastNodeErrors).toEqual(nodeErrors)
  })

  it('drops run errors on new runs without touching other graphs', () => {
    const store = useExecutionErrorStore()

    store.setActiveGraph(graphAId)
    store.recordNodeErrors(nodeErrors)

    store.setActiveGraph(graphBId)
    store.clearRunErrors()

    store.setActiveGraph(graphAId)
    expect(store.lastNodeErrors).toEqual(nodeErrors)

    store.clearRunErrors()
    expect(store.lastNodeErrors).toBeNull()
  })

  it('prunes a bucket when its last error is cleared', () => {
    const store = useExecutionErrorStore()
    const promptError = {
      type: 'execution',
      message: 'prompt failed',
      details: ''
    }

    store.setActiveGraph(graphAId)
    store.recordPromptError(promptError)
    expect(store.lastPromptError).toEqual(promptError)

    store.clearPromptError()
    store.setActiveGraph(graphBId)
    store.setActiveGraph(graphAId)

    expect(store.lastPromptError).toBeNull()
    expect(store.hasAnyError).toBe(false)
  })

  it('closes the error overlay when the active graph changes', () => {
    const store = useExecutionErrorStore()

    store.setActiveGraph(graphAId)
    store.recordNodeErrors(nodeErrors)
    store.showErrorOverlay()

    store.setActiveGraph(null)
    expect(store.isErrorOverlayOpen).toBe(false)

    store.setActiveGraph(graphAId)
    expect(store.isErrorOverlayOpen).toBe(false)
  })

  it('ignores errors recorded while no graph is active', () => {
    const store = useExecutionErrorStore()

    store.setActiveGraph(null)
    store.recordNodeErrors(nodeErrors)

    expect(store.lastNodeErrors).toBeNull()

    store.setActiveGraph(graphAId)
    expect(store.lastNodeErrors).toBeNull()
  })
})
