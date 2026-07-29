import { describe, expect, it } from 'vitest'

import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { validationError } from '@/utils/__tests__/nodeErrorHelpers'

import { getMissingResourceValidationErrorAbsorption } from './missingResourceAbsorption'

const nodeId = createNodeExecutionId([12, 4])

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

describe('getMissingResourceValidationErrorAbsorption', () => {
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

  it('absorbs a subgraph-promoted model at its lifted host node', () => {
    const hostNodeId = createNodeExecutionId([5])
    const sourceExecutionId = createNodeExecutionId([5, 3])
    const error = validationError('value_not_in_list', 'ckpt_name')

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
        hostNodeId
      )
    ).toBe('missing_model')
  })

  it('matches normalized model values by full-value equality', () => {
    const error = validationError('value_not_in_list', 'other_widget', {
      received_value: 'sdxl\\MODEL.SAFETENSORS'
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
      { received_value: 'inputs\\PORTRAIT.PNG' },
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

  it('absorbs promoted media value errors at their lifted host node', () => {
    const hostNodeId = createNodeExecutionId([5])
    const sourceExecutionId = createNodeExecutionId([5, 3])
    const error = validationError('value_not_in_list', 'image', {
      source_execution_id: sourceExecutionId
    })

    expect(
      getMissingResourceValidationErrorAbsorption(
        [],
        [missingMedia({ nodeId: sourceExecutionId })],
        error,
        hostNodeId
      )
    ).toBe('missing_media')
  })

  it('absorbs promoted image-not-loaded errors at their lifted host node', () => {
    const hostNodeId = createNodeExecutionId([5])
    const sourceExecutionId = createNodeExecutionId([5, 3])
    const error = validationError(
      'custom_validation_failed',
      'image',
      { source_execution_id: sourceExecutionId },
      'Invalid image file'
    )

    expect(
      getMissingResourceValidationErrorAbsorption(
        [],
        [missingMedia({ nodeId: sourceExecutionId })],
        error,
        hostNodeId
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
