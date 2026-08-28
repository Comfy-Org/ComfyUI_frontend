import { describe, expect, it } from 'vitest'

import {
  capturePromptResponse,
  isServerSideFault,
  serverSideFault,
  summarizePromptError
} from '@e2e/fixtures/customNode/promptSubmission'

describe('summarizePromptError', () => {
  it('names the node class and failing input', () => {
    expect(
      summarizePromptError({
        error: { type: 'prompt_outputs_failed_validation', message: 'failed' },
        node_errors: {
          '7': {
            class_type: 'ImpactInt',
            errors: [
              { type: 'value_not_in_list', message: 'msg', details: 'value' }
            ],
            dependent_outputs: []
          }
        }
      })
    ).toBe('failed; ImpactInt: value')
  })

  it('handles string errors, empty details, and invalid bodies', () => {
    expect(summarizePromptError({ error: 'bad request' })).toBe('bad request')
    expect(
      summarizePromptError({
        node_errors: {
          '3': {
            class_type: 'KSampler',
            errors: [
              { type: 'x', message: 'required input missing', details: '' }
            ],
            dependent_outputs: []
          }
        }
      })
    ).toBe('KSampler: required input missing')
    expect(summarizePromptError(null)).toBeUndefined()
    expect(summarizePromptError('not an object')).toBeUndefined()
  })
})

describe('capturePromptResponse', () => {
  it('classifies client rejections and server faults', () => {
    expect(
      capturePromptResponse(
        { sequence: 0 },
        {
          sequence: 1,
          status: 400,
          body: { error: { message: 'prompt rejected' }, node_errors: {} }
        }
      )
    ).toEqual({
      sequence: 1,
      promptId: undefined,
      rejection: {
        status: 400,
        summary: 'prompt rejected',
        errorType: undefined
      }
    })

    const server = capturePromptResponse(
      { sequence: 0 },
      {
        sequence: 1,
        status: 500,
        body: {
          error: {
            message: 'Failed to create job record',
            type: 'DATABASE_ERROR'
          }
        }
      }
    )
    const failure = serverSideFault(server.rejection!)
    expect(isServerSideFault(failure)).toBe(true)
    expect(failure.message).toBe(
      'prompt submission failed server-side (HTTP 500 POST /prompt) - Failed to create job record [type: DATABASE_ERROR] - backend/environment fault, not a pack validation reject'
    )
    expect(isServerSideFault(new Error('VALIDATION_FAIL'))).toBe(false)
  })

  it('preserves a newer successful response when an older body parses last', () => {
    const success = capturePromptResponse(
      { sequence: 0 },
      {
        sequence: 2,
        status: 200,
        body: { prompt_id: 'newer-success' },
        promptId: 'newer-success'
      }
    )
    expect(
      capturePromptResponse(success, {
        sequence: 1,
        status: 500,
        body: { error: { message: 'older rejection' } }
      })
    ).toBe(success)
  })

  it('represents a non-JSON 5xx as an environment fault', () => {
    const captured = capturePromptResponse(
      { sequence: 0 },
      { sequence: 1, status: 502, body: undefined }
    )
    expect(serverSideFault(captured.rejection!).message).toBe(
      'prompt submission failed server-side (HTTP 502 POST /prompt) - backend/environment fault, not a pack validation reject'
    )
  })
})
