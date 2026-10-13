import { describe, expect, it } from 'vitest'

import {
  failureDetail,
  failureFromResponse,
  failureFromStatus
} from './failure'
import { base64Bytes, parseDarkroomResponse } from './response'

const inline = (data: string, extra: object = {}) => ({
  inlineData: { mimeType: 'image/jpeg', data },
  ...extra
})

describe('parseDarkroomResponse', () => {
  it('reads the image, usage and finish reason of a normal answer', () => {
    expect(
      parseDarkroomResponse({
        candidates: [
          {
            content: { parts: [inline('FINAL')], role: 'model' },
            finishReason: 'STOP'
          }
        ],
        modelVersion: 'gemini-3.1-flash-lite-image',
        usageMetadata: { totalTokenCount: 1212 }
      })
    ).toEqual({
      images: [{ mime: 'image/jpeg', data: 'FINAL' }],
      texts: [],
      finishReasons: ['STOP'],
      blockReason: undefined,
      modelVersion: 'gemini-3.1-flash-lite-image',
      totalTokens: 1212
    })
  })

  it('drops thinking previews when a final image came back', () => {
    const { images } = parseDarkroomResponse({
      candidates: [
        {
          content: {
            parts: [
              inline('PREVIEW-1', { thought: true }),
              inline('PREVIEW-2', { thought: true }),
              inline('FINAL')
            ]
          }
        }
      ]
    })
    expect(images).toEqual([{ mime: 'image/jpeg', data: 'FINAL' }])
  })

  it('falls back to the last preview when nothing else came back', () => {
    const { images } = parseDarkroomResponse({
      candidates: [
        {
          content: {
            parts: [
              inline('PREVIEW-1', { thought: true }),
              inline('PREVIEW-2', { thought: true })
            ]
          }
        }
      ]
    })
    expect(images).toEqual([{ mime: 'image/jpeg', data: 'PREVIEW-2' }])
  })

  it('reads an image Router stored as a link', () => {
    const { images } = parseDarkroomResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                fileData: {
                  mimeType: 'image/png',
                  fileUri: 'https://storage.example/a.png'
                }
              },
              { fileData: { fileUri: 'http://insecure.example/b.png' } }
            ]
          }
        }
      ]
    })
    expect(images).toEqual([
      { mime: 'image/png', uri: 'https://storage.example/a.png' }
    ])
  })

  it('keeps what the model said, but not what it thought', () => {
    const { texts } = parseDarkroomResponse({
      candidates: [
        {
          content: {
            parts: [
              { text: 'planning the scene', thought: true },
              { text: 'Here is a description instead.' }
            ]
          }
        }
      ]
    })
    expect(texts).toEqual(['Here is a description instead.'])
  })

  it.for([null, 'oops', [], { candidates: 'none' }])(
    'reads %j as an answer with no image',
    (payload) => {
      expect(parseDarkroomResponse(payload).images).toEqual([])
    }
  )
})

describe('failureFromResponse', () => {
  const empty = { images: [], texts: [], finishReasons: [] }

  it('has nothing to report when an image came back', () => {
    expect(
      failureFromResponse({
        ...empty,
        images: [{ mime: 'image/png', data: 'A' }]
      })
    ).toBeUndefined()
  })

  it.for([
    [{ finishReasons: ['IMAGE_SAFETY'] }, 'blocked'],
    [{ finishReasons: ['PROHIBITED_CONTENT'] }, 'blocked'],
    [{ blockReason: 'BLOCKLIST' }, 'blocked'],
    [{ texts: ['I can describe it instead.'] }, 'noImageText'],
    [{ finishReasons: ['STOP'] }, 'noImage']
  ] as const)('reads %j as %s', ([response, failure]) => {
    expect(failureFromResponse({ ...empty, ...response })).toBe(failure)
  })

  it('keeps the raw reasons for the details', () => {
    expect(
      failureDetail({
        ...empty,
        blockReason: 'SAFETY',
        finishReasons: ['IMAGE_SAFETY'],
        texts: ['no']
      })
    ).toBe('blockReason: SAFETY\nfinishReason: IMAGE_SAFETY\nno')
  })
})

describe('failureFromStatus', () => {
  it.for([
    [402, null, 'noCredits'],
    [403, 'insufficient_credits', 'noCredits'],
    [400, 'content_policy_violation', 'blocked'],
    [200, 'cancelled', 'stopped'],
    [504, 'provider_timeout', 'timeout'],
    [400, 'invalid_input', 'settings'],
    [401, null, 'signedOut'],
    [403, 'forbidden', 'unavailable'],
    [413, null, 'tooLarge'],
    [429, 'concurrency_limit_exceeded', 'rateLimit'],
    [422, null, 'settings'],
    [504, 'deadline_exceeded', 'timeout'],
    [500, 'internal_error', 'generic']
  ] as const)('reads HTTP %s %s as %s', ([status, errorType, failure]) => {
    expect(failureFromStatus(status, errorType)).toBe(failure)
  })
})

describe('base64Bytes', () => {
  it('decodes image data to bytes', () => {
    expect([...base64Bytes('AQID')]).toEqual([1, 2, 3])
  })
})
