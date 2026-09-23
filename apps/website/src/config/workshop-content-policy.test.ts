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
      name: 'Gemini prompt block',
      payload: { promptFeedback: { blockReason: 'BLOCKLIST' } }
    },
    {
      name: 'Gemini candidate finish',
      payload: { candidates: [{ finishReason: 'IMAGE_SAFETY' }] }
    },
    {
      name: 'provider refusal message',
      payload: 'The request was rejected by risk control.'
    }
  ])('recognizes $name', ({ payload }) => {
    expect(workshopContentPolicyPayload(payload)).toBe(true)
  })

  it.for([
    {
      name: 'moderation service outage',
      payload: {
        code: 'ModerationServiceUnavailable',
        message: 'The content moderation service is unavailable.'
      }
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
    }
  ])('does not classify $name as policy', ({ payload }) => {
    expect(workshopContentPolicyPayload(payload)).toBe(false)
  })

  it('recognizes a non-JSON provider refusal body', () => {
    expect(
      workshopContentPolicyBody(
        'Input media did not pass content moderation. Request rejected.'
      )
    ).toBe(true)
    expect(workshopContentPolicyBody('')).toBe(false)
  })

  it('bounds traversal of wide provider payloads', () => {
    const payload = Array.from({ length: 200_000 }, () => null)

    expect(workshopContentPolicyPayload(payload)).toBe(false)
  })
})
