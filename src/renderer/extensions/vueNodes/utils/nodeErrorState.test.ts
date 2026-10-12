import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMissingMediaCandidate } from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import {
  nodeError,
  runtimeError,
  validationError
} from '@/utils/__tests__/nodeErrorHelpers'

import { getNodeErrorSeverity } from './nodeErrorState'

describe('Vue node error severity', () => {
  let rootGraph: LGraph
  let node: LGraphNode

  beforeEach(() => {
    rootGraph = createTestRootGraph()
    node = new LGraphNode('Loader')
    node.id = toNodeId(1)
    rootGraph.add(node)
    vi.spyOn(app, 'rootGraphOrUndefined', 'get').mockReturnValue(rootGraph)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)
    const settings = useSettingStore().settingValues
    settings['Comfy.RightSidePanel.ShowErrorsTab'] = false
    settings['Comfy.Workflow.ShowMissingNodesWarning'] = true
    settings['Comfy.ErrorSystem.ShowMissingModels'] = true
    settings['Comfy.Workflow.ShowMissingMediaWarning'] = true
  })

  it.for([
    {
      kind: 'node',
      seed: () =>
        useMissingNodesErrorStore().setMissingNodeTypes([
          { type: 'MissingNode', nodeId: 1 }
        ])
    },
    {
      kind: 'model',
      seed: () =>
        useMissingModelStore().setMissingModels([
          {
            nodeId: createNodeExecutionId([1]),
            nodeType: 'Loader',
            widgetName: 'ckpt_name',
            name: 'missing.safetensors',
            directory: 'checkpoints',
            isAssetSupported: false,
            isMissing: true
          }
        ])
    },
    {
      kind: 'media',
      seed: () =>
        useMissingMediaStore().setMissingMedia([
          createMissingMediaCandidate([toNodeId(1)], { isMissing: true })
        ])
    }
  ])('shows a missing $kind as a warning', ({ seed }) => {
    seed()
    expect(getNodeErrorSeverity(node._state, rootGraph.id, node)).toBe(
      'missing'
    )
  })

  it('keeps an absorbed model error amber, prioritizes unrelated errors, and clears after resolution', async () => {
    const models = useMissingModelStore()
    const errors = useExecutionErrorStore()
    const candidate = {
      nodeId: createNodeExecutionId([1]),
      nodeType: 'Loader',
      widgetName: 'ckpt_name',
      name: 'missing.safetensors',
      directory: 'checkpoints',
      isAssetSupported: false,
      isMissing: true
    }
    models.setMissingModels([candidate])
    const absorbed = validationError('value_not_in_list', 'ckpt_name')
    errors.recordNodeErrors({ '1': nodeError([absorbed]) })
    const severity = computed(() =>
      getNodeErrorSeverity(node._state, rootGraph.id, node)
    )
    expect(severity.value).toBe('missing')

    errors.recordNodeErrors({
      '1': nodeError([absorbed]),
      '2': nodeError([validationError('required_input_missing', 'positive')])
    })
    expect(severity.value).toBe('missing')

    errors.recordNodeErrors({
      '1': nodeError([
        absorbed,
        validationError('required_input_missing', 'positive')
      ])
    })
    expect(severity.value).toBe('error')

    errors.recordNodeErrors({ '1': nodeError([absorbed]) })
    expect(severity.value).toBe('missing')
    models.setMissingModels([])
    await nextTick()
    expect(severity.value).toBe('none')
  })

  it.for([
    { name: 'unverified', isMissing: undefined, visible: true },
    { name: 'hidden', isMissing: true, visible: false }
  ])(
    'does not absorb a backend error with an $name candidate',
    ({ isMissing, visible }) => {
      useSettingStore().settingValues['Comfy.ErrorSystem.ShowMissingModels'] =
        visible
      useMissingModelStore().setMissingModels([
        {
          nodeId: createNodeExecutionId([1]),
          nodeType: 'Loader',
          widgetName: 'ckpt_name',
          name: 'missing.safetensors',
          directory: 'checkpoints',
          isAssetSupported: false,
          isMissing
        }
      ])
      useExecutionErrorStore().recordNodeErrors({
        '1': nodeError([validationError('value_not_in_list', 'ckpt_name')])
      })
      expect(getNodeErrorSeverity(node._state, rootGraph.id, node)).toBe(
        'error'
      )
    }
  )

  it('aggregates nested errors into their ancestors without marking sibling containers', () => {
    const subgraph = createTestSubgraph({ rootGraph })
    const host = createTestSubgraphNode(subgraph, { id: 10 })
    rootGraph.add(host)
    const nested = createTestSubgraph({ rootGraph })
    const nestedHost = createTestSubgraphNode(nested, {
      parentGraph: subgraph,
      id: 20
    })
    subgraph.add(nestedHost)
    const other = createTestSubgraphNode(createTestSubgraph({ rootGraph }), {
      id: 100
    })
    rootGraph.add(other)
    useMissingNodesErrorStore().setMissingNodeTypes([
      { type: 'MissingNode', nodeId: '10:20:30' }
    ])
    expect(getNodeErrorSeverity(host._state, rootGraph.id, host)).toBe(
      'missing'
    )
    useExecutionErrorStore().recordNodeErrors({
      '10:20:30': nodeError([
        validationError('required_input_missing', 'positive')
      ])
    })
    expect([
      getNodeErrorSeverity(host._state, rootGraph.id, host),
      getNodeErrorSeverity(nestedHost._state, rootGraph.id, nestedHost),
      getNodeErrorSeverity(other._state, rootGraph.id, other)
    ]).toEqual(['error', 'error', 'none'])
  })

  it('keeps a lifted media validation error absorbed at its host', () => {
    const { host, interior } = createBoundaryLinkedSubgraph({
      rootGraph,
      hostId: 12,
      interiorId: 5,
      inputName: 'image',
      boundaryName: 'renamed_image'
    })
    useMissingMediaStore().setMissingMedia([
      createMissingMediaCandidate([toNodeId(12), toNodeId(5)], {
        isMissing: true
      })
    ])
    const errors = useExecutionErrorStore()
    errors.recordNodeErrors({
      '12:5': nodeError([validationError('value_not_in_list', 'image')])
    })
    expect(getNodeErrorSeverity(host._state, rootGraph.id, host)).toBe(
      'missing'
    )
    errors.recordExecutionError(runtimeError('12:5'))
    expect(getNodeErrorSeverity(host._state, rootGraph.id, host)).toBe('error')
    expect(getNodeErrorSeverity(interior._state, rootGraph.id, interior)).toBe(
      'error'
    )
    expect(getNodeErrorSeverity(node._state, rootGraph.id, node)).toBe('none')
  })
})
