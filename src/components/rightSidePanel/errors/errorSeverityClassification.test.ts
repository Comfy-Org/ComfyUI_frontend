import { describe, expect, it } from 'vitest'

import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

import { classifyErrorSeverity } from './errorSeverityClassification'
import type { ErrorSeverityInput } from './errorSeverityClassification'

function classify(overrides: Partial<ErrorSeverityInput> = {}) {
  return classifyErrorSeverity({
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

describe('classifyErrorSeverity', () => {
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

  it('classifies an execution error with an unnormalisable node id as blocking', () => {
    const classification = classify({
      executionError: runtimeError('not::a-node')
    })

    expect(classification.executionError?.nodeId).toBeNull()
    expect(classification.hasBlockingError).toBe(true)
  })
})
