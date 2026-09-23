import { describe, expect, it } from 'vitest'

import { liftNodeErrorsToBoundary } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { scanAllModelCandidates } from '@/platform/missingModel/missingModelScan'
import {
  createMissingMediaCandidate,
  createPromotedMediaRuntime,
  seedMediaNodeDefs
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { scanAllMediaCandidates } from '@/platform/missingMedia/missingMediaScan'
import {
  getExecutionIdByNode,
  isCandidateScopeActive
} from '@/utils/graphTraversalUtil'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

import { classifyPanelErrors } from './errorSeverityClassification'
import { classifyValidationErrorAbsorption } from './missingResourceAbsorption'

const nodeId = createNodeExecutionId([12, 4])
const liftedHostNodeId = createNodeExecutionId([12])
const liftedSourceNodeId = createNodeExecutionId([12, 5])
if (!nodeId || !liftedHostNodeId || !liftedSourceNodeId) {
  throw new Error('Expected non-empty node execution IDs')
}

function missingModel(
  overrides: Partial<MissingModelCandidate> = {}
): MissingModelCandidate {
  return {
    nodeId,
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    isAssetSupported: false,
    name: 'model.safetensors',
    directory: 'checkpoints',
    isMissing: true,
    ...overrides
  }
}

function missingMedia(
  overrides: Partial<MissingMediaCandidate> = {}
): MissingMediaCandidate {
  return createMissingMediaCandidate([toNodeId(12), toNodeId(4)], {
    name: 'portrait.png',
    ...overrides
  })
}

function liftValidationError(
  boundaryName: string,
  inputName: string,
  error: NodeValidationError
): NodeValidationError {
  const { rootGraph } = createBoundaryLinkedSubgraph({
    boundaryName,
    inputName
  })
  const lifted = liftNodeErrorsToBoundary(rootGraph, {
    [liftedSourceNodeId]: nodeError([error])
  })[liftedHostNodeId]?.errors.at(0)
  if (!lifted) {
    throw new Error('Expected validation error to be lifted')
  }
  return lifted
}

function createDuplicatePromotedModelFixture(secondModelValue = 'None') {
  const rootGraph = createTestRootGraph()
  const subgraph = createTestSubgraph({ rootGraph })
  const host = createTestSubgraphNode(subgraph, { id: 12 })
  rootGraph.add(host)

  function addPromotedModelNode(id: number) {
    const node = new LGraphNode(
      'CheckpointLoaderSimple',
      'CheckpointLoaderSimple'
    )
    node.id = toNodeId(id)
    const input = node.addInput('ckpt_name', 'COMBO')
    const widget = node.addWidget('combo', 'ckpt_name', '', () => {}, {
      values: ['present.safetensors']
    })
    input.widget = { name: widget.name }
    subgraph.add(node)
    if (!promoteValueWidgetViaSubgraphInput(host, node, widget).ok) {
      throw new Error('Expected model widget promotion to succeed')
    }
  }

  addPromotedModelNode(5)
  addPromotedModelNode(7)

  const widgetValueStore = useWidgetValueStore()
  const firstInput = host.inputs.find((input) => input.name === 'ckpt_name')
  const secondInput = host.inputs.find((input) => input.name === 'ckpt_name_1')
  if (!firstInput?.widgetId || !secondInput?.widgetId) {
    throw new Error('Expected promoted model inputs')
  }
  widgetValueStore.setValue(firstInput.widgetId, 'missing.safetensors')
  widgetValueStore.setValue(secondInput.widgetId, secondModelValue)

  return {
    candidates: scanAllModelCandidates(rootGraph, () => false),
    nodeErrors: liftNodeErrorsToBoundary(rootGraph, {
      '12:5': nodeError([validationError('value_not_in_list', 'ckpt_name')]),
      '12:7': nodeError([validationError('value_not_in_list', 'ckpt_name')])
    })
  }
}

function createPromotedModelFanout(nested = false) {
  const inner = createTestSubgraph({
    inputs: [{ name: 'shared_model', type: 'COMBO' }]
  })
  const rootGraph = inner.rootGraph
  const sources = [42, 43, 44].map((id) => {
    const node = new LGraphNode(
      'CheckpointLoaderSimple',
      'CheckpointLoaderSimple'
    )
    node.id = toNodeId(id)
    const input = node.addInput('ckpt_name', 'COMBO')
    const widget = node.addWidget(
      'combo',
      'ckpt_name',
      'present.safetensors',
      () => {},
      {
        values: ['present.safetensors']
      }
    )
    input.widget = { name: widget.name }
    inner.add(node)
    if (!inner.inputNode.slots[0].connect(input, node)) {
      throw new Error('Expected shared model input connection')
    }
    return node
  })
  let subgraph = inner
  if (nested) {
    subgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'outer_model', type: 'COMBO' }]
    })
    const middle = createTestSubgraphNode(inner, {
      parentGraph: subgraph,
      id: 77
    })
    subgraph.add(middle)
    if (!subgraph.inputNode.slots[0].connect(middle.inputs[0], middle)) {
      throw new Error('Expected nested model input connection')
    }
  }
  const hosts = [65, 66].map((id) => {
    const host = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph,
      id
    })
    rootGraph.add(host)
    host.widgets[0].value = 'missing.safetensors'
    return host
  })
  return { rootGraph, sources, hosts }
}

it.for([
  {
    nested: false,
    paths: [
      [65, 42],
      [65, 43],
      [65, 44],
      [66, 42],
      [66, 43],
      [66, 44]
    ]
  },
  {
    nested: true,
    paths: [
      [65, 77, 42],
      [65, 77, 43],
      [65, 77, 44],
      [66, 77, 42],
      [66, 77, 43],
      [66, 77, 44]
    ]
  }
] as const)(
  'absorbs every promoted model consumer without crossing host instances: nested=$nested',
  ({ nested, paths }) => {
    const { rootGraph } = createPromotedModelFanout(nested)
    const candidates = scanAllModelCandidates(rootGraph, () => false)
    expect(candidates).toHaveLength(2)
    const ids = paths.map((path) => createNodeExecutionId(path))
    expect
      .soft(candidates.flatMap((candidate) => candidate.promotedSources))
      .toEqual(
        ids.map((executionId) => ({ executionId, widgetName: 'ckpt_name' }))
      )
    const error = validationError('value_not_in_list', 'ckpt_name')
    expect(
      ids.map((id) =>
        classifyValidationErrorAbsorption(candidates, [], error, id)
      )
    ).toEqual(Array(6).fill('missing_model'))
    expect(
      classifyValidationErrorAbsorption([candidates[0]], [], error, ids[3])
    ).toBeNull()
    const result = classifyPanelErrors({
      promptError: null,
      executionError: null,
      nodeErrors: liftNodeErrorsToBoundary(
        rootGraph,
        Object.fromEntries(ids.map((id) => [id, nodeError([error])]))
      ),
      missingModels: candidates,
      missingMedia: [],
      hasMissingNodes: false
    })
    expect(
      result.nodeErrors.flatMap(({ errors }) =>
        errors.map(({ absorption }) => absorption)
      )
    ).toEqual(Array(6).fill('missing_model'))
    expect(result.hasBlockingError).toBe(false)
    expect(
      classifyValidationErrorAbsorption(
        candidates,
        [],
        validationError('value_not_in_list', 'other_model', {
          received_value: 'missing.safetensors'
        }),
        ids[0]
      )
    ).toBeNull()
  }
)

it.for([LGraphEventMode.BYPASS, LGraphEventMode.NEVER])(
  'keeps promoted models with other active consumers when the first consumer has mode %i',
  (mode) => {
    const { rootGraph, sources } = createPromotedModelFanout()
    sources[0].mode = mode
    sources[1].type = 'AlternateCheckpointLoader'
    sources[0].properties.models = [
      {
        name: 'missing.safetensors',
        url: 'https://example.com/stored-model.safetensors',
        directory: 'checkpoints'
      }
    ]
    sources[1].properties.models = [
      {
        name: 'missing.safetensors',
        url: 'https://example.com/other-model.safetensors',
        directory: 'checkpoints'
      }
    ]
    const candidates = scanAllModelCandidates(rootGraph, () => false)
    expect(candidates).toMatchObject([
      {
        nodeId: '65',
        nodeType: 'CheckpointLoaderSimple',
        sourceExecutionId: '65:42',
        url: 'https://example.com/stored-model.safetensors'
      },
      {
        nodeId: '66',
        nodeType: 'CheckpointLoaderSimple',
        sourceExecutionId: '66:42',
        url: 'https://example.com/stored-model.safetensors'
      }
    ])
    expect(
      candidates.flatMap((candidate) => candidate.promotedSources)
    ).toEqual([
      { executionId: '65:43', widgetName: 'ckpt_name' },
      { executionId: '65:44', widgetName: 'ckpt_name' },
      { executionId: '66:43', widgetName: 'ckpt_name' },
      { executionId: '66:44', widgetName: 'ckpt_name' }
    ])
  }
)

it('keeps a pending promoted model active until its last consumer is inactive', () => {
  const { rootGraph, sources } = createPromotedModelFanout()
  const candidates = scanAllModelCandidates(rootGraph, () => false)
  sources[0].mode = LGraphEventMode.BYPASS
  expect(
    candidates.map((candidate) => isCandidateScopeActive(rootGraph, candidate))
  ).toEqual([true, true])
  sources[1].mode = LGraphEventMode.NEVER
  sources[2].mode = LGraphEventMode.BYPASS
  expect(
    candidates.map((candidate) => isCandidateScopeActive(rootGraph, candidate))
  ).toEqual([false, false])
})

describe('missing resource validation error absorption', () => {
  it('matches a missing model by execution node and widget', () => {
    const error = validationError('value_not_in_list', 'ckpt_name')

    expect(
      classifyValidationErrorAbsorption([missingModel()], [], error, nodeId)
    ).toBe('missing_model')
  })

  it('absorbs a fail-open interior model error by source execution id', () => {
    const sourceExecutionId = createNodeExecutionId([5, 3])
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const host = createTestSubgraphNode(subgraph, { id: 5 })
    rootGraph.add(host)
    const interior = new LGraphNode('CheckpointLoaderSimple')
    interior.id = toNodeId(3)
    interior.addInput('ckpt_name', 'COMBO')
    subgraph.add(interior)
    const error = liftNodeErrorsToBoundary(rootGraph, {
      [sourceExecutionId]: nodeError([
        validationError('value_not_in_list', 'ckpt_name')
      ])
    })[sourceExecutionId]?.errors[0]

    expect(
      classifyValidationErrorAbsorption(
        [
          missingModel({
            nodeId: '5',
            sourceExecutionId
          })
        ],
        [],
        error,
        sourceExecutionId
      )
    ).toBe('missing_model')
  })

  it('matches normalized model values when the error names no input', () => {
    const error: NodeValidationError = {
      type: 'value_not_in_list',
      message: 'value_not_in_list message',
      details: 'value_not_in_list details',
      extra_info: { received_value: 'SDXL\\model.safetensors' }
    }

    expect(
      classifyValidationErrorAbsorption(
        [missingModel({ name: 'SDXL/model.safetensors' })],
        [],
        error,
        nodeId
      )
    ).toBe('missing_model')
  })

  it('keeps a same-valued sibling widget error blocking', () => {
    // The candidate tracks ckpt_name; the error names a different input whose
    // received value happens to collide. Value equality alone must not absorb.
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'SDXL\\model.safetensors'
    })

    expect(
      classifyValidationErrorAbsorption(
        [missingModel({ name: 'SDXL/model.safetensors' })],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('matches image-not-loaded media errors by normalized value when the error names no input', () => {
    const error: NodeValidationError = {
      type: 'custom_validation_failed',
      message: 'Invalid image file',
      details: 'custom_validation_failed details',
      extra_info: { received_value: 'inputs\\portrait.png' }
    }

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ name: 'inputs/portrait.png' })],
        error,
        nodeId
      )
    ).toBe('missing_media')
  })

  it('keeps a same-valued sibling media widget error blocking', () => {
    const error = validationError(
      'custom_validation_failed',
      'other_widget',
      { received_value: 'inputs\\portrait.png' },
      'Invalid image file'
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ name: 'inputs/portrait.png' })],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb an input-name collision on a different node', () => {
    const otherNode = createNodeExecutionId([99])
    const error = validationError('value_not_in_list', 'ckpt_name', {
      received_value: 'model.safetensors'
    })

    expect(
      classifyValidationErrorAbsorption(
        [missingModel({ nodeId: otherNode, sourceExecutionId: undefined })],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb a media widget-name collision on a different node', () => {
    const otherNode = createNodeExecutionId([99])
    const error = validationError(
      'custom_validation_failed',
      'image',
      { received_value: 'portrait.png' },
      'Invalid image file'
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ nodeId: otherNode })],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb while a candidate is still pending verification', () => {
    const error = validationError('value_not_in_list', 'ckpt_name', {
      received_value: 'model.safetensors'
    })

    expect(
      classifyValidationErrorAbsorption(
        [missingModel({ isMissing: undefined })],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb a differently-cased missing candidate', () => {
    const error: NodeValidationError = {
      type: 'value_not_in_list',
      message: 'value_not_in_list message',
      details: 'value_not_in_list details',
      extra_info: { received_value: 'SDXL/Model.safetensors' }
    }

    expect(
      classifyValidationErrorAbsorption(
        [
          missingModel({ name: 'sdxl/model.safetensors' }),
          missingModel({
            name: 'SDXL/Model.safetensors',
            isMissing: false
          })
        ],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('absorbs promoted media value errors at their lifted host node', () => {
    const error = liftValidationError(
      'image',
      'image',
      validationError('value_not_in_list', 'image')
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ nodeId: liftedSourceNodeId })],
        error,
        liftedHostNodeId
      )
    ).toBe('missing_media')
  })

  it('absorbs a renamed media input using its lifted interior name', () => {
    const error = liftValidationError(
      'source_image',
      'image',
      validationError('value_not_in_list', 'image')
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [
          missingMedia({
            nodeId: liftedSourceNodeId,
            widgetName: 'image'
          })
        ],
        error,
        liftedHostNodeId
      )
    ).toBe('missing_media')
  })

  it('does not rely on received value to absorb a renamed media input', () => {
    const error = liftValidationError(
      'source_image',
      'image',
      validationError('value_not_in_list', 'image', {
        received_value: 'different-cloud-asset-hash'
      })
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [
          missingMedia({
            nodeId: liftedSourceNodeId,
            widgetName: 'image',
            name: 'expected-cloud-asset-hash'
          })
        ],
        error,
        liftedHostNodeId
      )
    ).toBe('missing_media')
  })

  it('does not absorb a lifted error with no matching interior input', () => {
    const error = liftValidationError(
      'source_image',
      'image',
      validationError('value_not_in_list', 'image')
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [
          missingMedia({
            nodeId: liftedSourceNodeId,
            widgetName: 'audio'
          })
        ],
        error,
        liftedHostNodeId
      )
    ).toBeNull()
  })

  it('keeps a same-named promoted sibling error blocking', () => {
    const { candidates, nodeErrors } = createDuplicatePromotedModelFixture()

    expect(candidates).toMatchObject([
      {
        nodeId: '12',
        sourceExecutionId: '12:5',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        isMissing: true
      }
    ])

    const result = classifyPanelErrors({
      promptError: null,
      executionError: null,
      nodeErrors,
      missingModels: candidates,
      missingMedia: [],
      hasMissingNodes: false
    })

    expect(
      result.nodeErrors.flatMap(({ errors }) =>
        errors.map(({ absorption }) => absorption)
      )
    ).toEqual(['missing_model', null])
    expect(result.hasBlockingError).toBe(true)
  })

  it('absorbs each same-named promoted error into its own model candidate', () => {
    const { candidates, nodeErrors } =
      createDuplicatePromotedModelFixture('beta.safetensors')

    const result = classifyPanelErrors({
      promptError: null,
      executionError: null,
      nodeErrors,
      missingModels: candidates,
      missingMedia: [],
      hasMissingNodes: false
    })

    expect(
      result.nodeErrors.flatMap(({ errors }) =>
        errors.map(({ absorption }) => absorption)
      )
    ).toEqual(['missing_model', 'missing_model'])
    expect(result.hasBlockingError).toBe(false)
  })

  it('absorbs interior image-not-loaded errors without boundary lifting', () => {
    const error = validationError(
      'custom_validation_failed',
      'image',
      {},
      'Invalid image file'
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ nodeId: liftedSourceNodeId })],
        error,
        liftedSourceNodeId
      )
    ).toBe('missing_media')
  })

  it('does not absorb unrelated validation errors on the same node', () => {
    const error = validationError('value_bigger_than_max', 'ckpt_name')

    expect(
      classifyValidationErrorAbsorption([missingModel()], [], error, nodeId)
    ).toBeNull()
  })

  it('does not absorb an untracked resource', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'loras/model.safetensors'
    })

    expect(classifyValidationErrorAbsorption([], [], error, nodeId)).toBeNull()
  })

  it('does not absorb a confirmed-installed model candidate', () => {
    const error = validationError('value_not_in_list', 'ckpt_name')

    expect(
      classifyValidationErrorAbsorption(
        [missingModel({ isMissing: false })],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb a different model value', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'loras/model.safetensors'
    })

    expect(
      classifyValidationErrorAbsorption([missingModel()], [], error, nodeId)
    ).toBeNull()
  })

  it('does not absorb a confirmed-present media candidate', () => {
    const error = validationError(
      'custom_validation_failed',
      'image',
      {},
      'Invalid image file'
    )

    expect(
      classifyValidationErrorAbsorption(
        [],
        [missingMedia({ isMissing: false })],
        error,
        nodeId
      )
    ).toBeNull()
  })
})

it.for([1, 2] as const)(
  'absorbs image errors from every active promoted consumer at depth %i',
  (depth) => {
    seedMediaNodeDefs()
    const { rootGraph, sourceNodes } = createPromotedMediaRuntime({
      sourceIds: [42, 43, 44],
      depth
    })
    const candidates = scanAllMediaCandidates(rootGraph, false)
    expect(candidates).toHaveLength(1)

    for (const node of sourceNodes) {
      const executionId = getExecutionIdByNode(rootGraph, node)
      if (!executionId) throw new Error('Expected a source execution id')
      const errors = liftNodeErrorsToBoundary(rootGraph, {
        [executionId]: nodeError([
          validationError(
            'custom_validation_failed',
            'image',
            {},
            'Invalid image file'
          )
        ])
      })
      const classification = classifyPanelErrors({
        promptError: null,
        executionError: null,
        nodeErrors: errors,
        missingModels: null,
        missingMedia: candidates,
        hasMissingNodes: false
      })
      expect.soft(classification.hasBlockingError, executionId).toBe(false)
    }
  }
)
