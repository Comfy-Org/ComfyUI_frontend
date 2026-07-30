import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { liftNodeErrorsToBoundary } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { scanAllModelCandidates } from '@/platform/missingModel/missingModelScan'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

import { classifyPanelErrors } from './errorSeverityClassification'
import { getMissingResourceValidationErrorAbsorption } from './missingResourceAbsorption'

const nodeId = createNodeExecutionId([12, 4])
const liftedHostNodeId = createNodeExecutionId([12])
const liftedSourceNodeId = createNodeExecutionId([12, 5])

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

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
  return {
    nodeId,
    nodeType: 'LoadImage',
    widgetName: 'image',
    mediaType: 'image',
    name: 'portrait.png',
    isMissing: true,
    ...overrides
  }
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
  })[liftedHostNodeId]?.errors[0]
  if (!lifted) throw new Error('Expected validation error to be lifted')
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

describe('missing resource validation error absorption', () => {
  it('matches a missing model by execution node and widget', () => {
    const error = validationError('value_not_in_list', 'ckpt_name')

    expect(
      getMissingResourceValidationErrorAbsorption(
        [missingModel()],
        [],
        error,
        nodeId
      )
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
    if (!error) throw new Error('Expected validation error to remain interior')

    expect(
      getMissingResourceValidationErrorAbsorption(
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

  it('matches normalized model values by full-value equality', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'SDXL\\model.safetensors'
    })

    expect(
      getMissingResourceValidationErrorAbsorption(
        [missingModel({ name: 'SDXL/model.safetensors' })],
        [],
        error,
        nodeId
      )
    ).toBe('missing_model')
  })

  it('matches image-not-loaded media errors by normalized value', () => {
    const error = validationError(
      'custom_validation_failed',
      'other_widget',
      { received_value: 'inputs\\portrait.png' },
      'Invalid image file'
    )

    expect(
      getMissingResourceValidationErrorAbsorption(
        [],
        [missingMedia({ name: 'inputs/portrait.png' })],
        error,
        nodeId
      )
    ).toBe('missing_media')
  })

  it('does not absorb a differently-cased missing candidate', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'SDXL/Model.safetensors'
    })

    expect(
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
        [missingModel()],
        [],
        error,
        nodeId
      )
    ).toBeNull()
  })

  it('does not absorb an untracked resource', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'loras/model.safetensors'
    })

    expect(
      getMissingResourceValidationErrorAbsorption([], [], error, nodeId)
    ).toBeNull()
  })

  it('does not absorb a confirmed-installed model candidate', () => {
    const error = validationError('value_not_in_list', 'ckpt_name')

    expect(
      getMissingResourceValidationErrorAbsorption(
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
      getMissingResourceValidationErrorAbsorption(
        [missingModel()],
        [],
        error,
        nodeId
      )
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
      getMissingResourceValidationErrorAbsorption(
        [],
        [missingMedia({ isMissing: false })],
        error,
        nodeId
      )
    ).toBeNull()
  })
})
