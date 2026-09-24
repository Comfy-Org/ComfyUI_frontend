import { describe, expect, it } from 'vitest'

import {
  workshopContentPolicyBody,
  workshopContentPolicyPayload
} from './workshop-content-policy'

describe('Workshop content-policy attribution', () => {
  it.for([
    {
      name: 'provider code',
      payload: { error: { code: 'moderation_blocked' } }
    },
    {
      name: 'xAI Imagine moderation code',
      payload: {
        code: 'imagine:content-moderated',
        error: 'Generated video rejected by content moderation.'
      }
    },
    {
      name: 'nested provider body',
      payload: {
        detail: '{"code":"DataInspectionFailed","message":"provider refused"}'
      }
    },
    {
      name: 'Runway safety code',
      payload: { failures: [{ failureCode: 'SAFETY.OUTPUT.MULTIMODAL' }] }
    },
    {
      name: 'Runway preprocessing safety code',
      payload: { failureCode: 'INPUT_PREPROCESSING.SAFETY.TEXT' }
    },
    {
      name: 'Kling task status message',
      payload: {
        data: {
          task_status: 'failed',
          task_status_msg: 'Failure to pass the risk control system'
        }
      }
    },
    {
      name: 'BFL moderation status',
      payload: { id: 'task', status: 'Content Moderated', result: null }
    },
    {
      name: 'Gemini prompt block',
      payload: { promptFeedback: { blockReason: 'BLOCKLIST' } }
    },
    {
      name: 'Gemini candidate finish',
      payload: { candidates: [{ finishReason: 'IMAGE_SAFETY' }] }
    },
    {
      name: 'Gemini copyright recitation refusal',
      payload: { candidates: [{ finishReason: 'RECITATION' }] }
    },
    {
      name: 'provider refusal message',
      payload: { failure: 'The request was rejected by risk control.' }
    }
  ])('recognizes $name', ({ payload }) => {
    expect(workshopContentPolicyPayload(payload)).toBe(true)
  })

  it.for([
    {
      name: 'xAI validation error',
      payload: { code: 'invalid-argument', error: 'Unsupported resolution.' }
    },
    {
      name: 'moderation service outage',
      payload: {
        code: 'ModerationServiceUnavailable',
        message: 'The content moderation service is unavailable.'
      }
    },
    {
      name: 'snake-case moderation outage',
      payload: {
        error: {
          code: 'content_moderation_unavailable',
          message: 'upstream timeout'
        }
      }
    },
    {
      name: 'content-filter processing error',
      payload: { error: { code: 'content_filter_error' } }
    },
    {
      name: 'dotted safety-check timeout',
      payload: { error: { code: 'safety.input.check timed out' } }
    },
    {
      name: 'successful Gemini response',
      payload: { candidates: [{ finishReason: 'STOP' }] }
    },
    {
      name: 'generated text discussing policy',
      payload: { text: 'An explanation of a content policy violation.' }
    },
    {
      name: 'generated text quoting provider codes',
      payload: { text: 'Compare moderation_blocked with content_filter.' }
    },
    {
      name: 'unspecified Gemini block reason',
      payload: { promptFeedback: { blockReason: 'BLOCK_REASON_UNSPECIFIED' } }
    },
    {
      name: 'validation error quoting the prompt',
      payload: {
        detail: 'prompt "this violates our content policy" is too long'
      }
    },
    {
      name: 'tool-call arguments discussing policy',
      payload: {
        output: [
          {
            type: 'function_call',
            arguments: {
              reason: 'The user asked what violates our content policy',
              message: 'Explain content_filter behavior'
            }
          }
        ]
      }
    }
  ])('does not classify $name as policy', ({ payload }) => {
    expect(workshopContentPolicyPayload(payload)).toBe(false)
  })

  it.for([
    '',
    'Input media did not pass content moderation. Request rejected.',
    '<html>content_filter upstream failure</html>',
    '{"error":{"code":"content_filter"}'
  ])('does not classify an incomplete or non-JSON body', (body) => {
    expect(workshopContentPolicyBody(body)).toBe(false)
  })

  it('bounds traversal of wide provider payloads', () => {
    const payload = Array.from({ length: 200_000 }, () => null)

    expect(workshopContentPolicyPayload(payload)).toBe(false)
  })
})
