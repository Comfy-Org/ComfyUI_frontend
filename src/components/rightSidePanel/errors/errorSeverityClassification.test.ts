import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { liftNodeErrorsToBoundary } from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { scanAllModelCandidates } from '@/platform/missingModel/missingModelScan'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { toNodeId } from '@/types/nodeId'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

import { classifyPanelErrors } from './errorSeverityClassification'
import type { ErrorSeverityInput } from './errorSeverityClassification'

beforeEach(() => {
  setActivePinia(createPinia())
})

function classify(overrides: Partial<ErrorSeverityInput> = {}) {
  return classifyPanelErrors({
    promptError: null,
    executionError: null,
    nodeErrors: null,
    missingModels: null,
    missingMedia: null,
    hasMissingNodes: false,
    ...overrides
  })
}

function runtimeError(nodeId: string): ExecutionErrorWsMessage {
  return {
    prompt_id: 'prompt',
    timestamp: 0,
    node_id: nodeId,
    node_type: 'KSampler',
    executed: [],
    exception_type: 'RuntimeError',
    exception_message: 'Execution failed',
    traceback: []
  }
}

function createUnnormalisableModelErrorFixture() {
  const rootGraph = createTestRootGraph()
  const node = new LGraphNode('CheckpointLoaderSimple')
  node.id = toNodeId('not::a-node')
  const input = node.addInput('ckpt_name', 'COMBO')
  const widget = node.addWidget(
    'combo',
    'ckpt_name',
    'missing.safetensors',
    () => {},
    { values: ['present.safetensors'] }
  )
  input.widget = { name: widget.name }
  rootGraph.add(node)

  return {
    missingModels: scanAllModelCandidates(rootGraph, () => false),
    nodeErrors: liftNodeErrorsToBoundary(rootGraph, {
      'not::a-node': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })
  }
}

describe('classifyPanelErrors', () => {
  it('classifies a prompt error as blocking', () => {
    expect(
      classify({
        promptError: {
          type: 'prompt_no_outputs',
          message: 'No outputs',
          details: ''
        }
      }).hasBlockingError
    ).toBe(true)
  })

  it('classifies an absorbed missing-node prompt as non-blocking', () => {
    expect(
      classify({
        promptError: {
          type: 'missing_node_type',
          message: 'Missing node',
          details: ''
        },
        hasMissingNodes: true
      }).hasBlockingError
    ).toBe(false)
  })

  it('classifies an absorbed missing-model validation error as non-blocking', () => {
    const missingModel = {
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: false,
      name: 'missing.safetensors',
      isMissing: true
    } satisfies MissingModelCandidate

    expect(
      classify({
        nodeErrors: {
          '1': nodeError([validationError('value_not_in_list', 'ckpt_name')])
        },
        missingModels: [missingModel]
      }).hasBlockingError
    ).toBe(false)
  })

  it('classifies an unabsorbed validation error as blocking', () => {
    expect(
      classify({
        nodeErrors: {
          '1': nodeError([validationError('value_not_in_list', 'other_widget')])
        }
      }).hasBlockingError
    ).toBe(true)
  })

  it('keeps an unnormalisable matching model error blocking', () => {
    const fixture = createUnnormalisableModelErrorFixture()
    const classification = classify(fixture)

    expect(classification.nodeErrors[0].nodeId).toBeNull()
    expect(classification.nodeErrors[0].errors[0].absorption).toBeNull()
    expect(classification.hasBlockingError).toBe(true)
  })

  it('classifies an execution error with an unnormalisable node id as blocking', () => {
    const classification = classify({
      executionError: runtimeError('not::a-node')
    })

    expect(classification.executionError?.nodeId).toBeNull()
    expect(classification.hasBlockingError).toBe(true)
  })
})
