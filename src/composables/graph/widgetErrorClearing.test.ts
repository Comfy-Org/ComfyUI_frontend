import { describe, expect, it, vi } from 'vitest'

import { clearWidgetRelatedErrorScopes } from '@/composables/graph/widgetErrorClearing'
import { createNodeExecutionId } from '@/types/nodeIdentification'

describe('clearWidgetRelatedErrorScopes', () => {
  it('clears only the host scope for normal widgets', () => {
    const clearWidgetRelatedErrors = vi.fn()

    clearWidgetRelatedErrorScopes({
      clearWidgetRelatedErrors,
      host: {
        executionId: createNodeExecutionId([65]),
        widgetName: 'ckpt_name'
      },
      value: 'real_model.safetensors',
      range: { min: 0, max: 10 }
    })

    expect(clearWidgetRelatedErrors).toHaveBeenCalledOnce()
    expect(clearWidgetRelatedErrors).toHaveBeenCalledWith(
      createNodeExecutionId([65]),
      'ckpt_name',
      'ckpt_name',
      'real_model.safetensors',
      { min: 0, max: 10 }
    )
  })

  it('preserves distinct validation and missing-asset widget names', () => {
    const clearWidgetRelatedErrors = vi.fn()

    clearWidgetRelatedErrorScopes({
      clearWidgetRelatedErrors,
      host: {
        executionId: createNodeExecutionId([65]),
        errorInputName: 'display_name',
        widgetName: 'store_name'
      },
      value: 'real_model.safetensors'
    })

    expect(clearWidgetRelatedErrors).toHaveBeenCalledWith(
      createNodeExecutionId([65]),
      'display_name',
      'store_name',
      'real_model.safetensors',
      undefined
    )
  })

  it('clears promoted source scope before host scope', () => {
    const clearWidgetRelatedErrors = vi.fn()

    clearWidgetRelatedErrorScopes({
      clearWidgetRelatedErrors,
      source: {
        executionId: createNodeExecutionId([65, 42]),
        widgetName: 'ckpt_name'
      },
      host: {
        executionId: createNodeExecutionId([65]),
        widgetName: 'promoted_ckpt'
      },
      value: 'real_model.safetensors',
      range: { min: undefined, max: undefined }
    })

    expect(clearWidgetRelatedErrors).toHaveBeenNthCalledWith(
      1,
      createNodeExecutionId([65, 42]),
      'ckpt_name',
      'ckpt_name',
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
    expect(clearWidgetRelatedErrors).toHaveBeenNthCalledWith(
      2,
      createNodeExecutionId([65]),
      'promoted_ckpt',
      'promoted_ckpt',
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
  })
})
