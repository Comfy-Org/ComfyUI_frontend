import type { ErrorEvent, EventHint } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'

describe('third-party error noise', () => {
  it.for([
    {
      event: { type: undefined },
      hint: { originalException: new Error(EXTENSION_ERROR) }
    },
    {
      event: { type: undefined, message: `Error: ${EXTENSION_ERROR}` },
      hint: {}
    },
    {
      event: {
        type: undefined,
        exception: { values: [{ value: EXTENSION_ERROR }] }
      },
      hint: {}
    }
  ] satisfies Array<{ event: ErrorEvent; hint: EventHint }>)(
    'drops the extension error from Sentry',
    ({ event, hint }) => {
      expect(sentryThirdPartyErrorFilter(event, hint)).toBeNull()
    }
  )

  it.for([
    { name: 'no stack frames', stacktrace: undefined },
    {
      name: 'only page-URL frames',
      stacktrace: {
        frames: [{ filename: 'https://cloud.example.com/cloud/user-check' }]
      }
    },
    {
      name: 'only third-party frames',
      stacktrace: {
        frames: [{ filename: 'https://cdn.example.com/widget.js' }]
      }
    }
  ])('drops a minified message with $name', ({ stacktrace }) => {
    const event = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: 'pa', stacktrace }] }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBeNull()
  })

  it.for([
    {
      name: 'a first-party frame',
      value: 'pa',
      frames: [
        { filename: 'https://cdn.example.com/widget.js' },
        { filename: 'https://cloud.example.com/assets/index-abc123.js' }
      ]
    },
    { name: 'a longer message', value: 'Application failed', frames: [] },
    { name: 'a four-character message', value: 'abcd', frames: [] },
    { name: 'a message with punctuation', value: 'p a', frames: [] }
  ])('keeps a short-message look-alike with $name', ({ value, frames }) => {
    const event = {
      type: undefined,
      exception: { values: [{ value, stacktrace: { frames } }] }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps a minified message when a linked exception has a first-party frame', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          { value: 'pa' },
          {
            value: 'ab',
            stacktrace: {
              frames: [{ filename: 'https://cloud.example.com/assets/app.js' }]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps ordinary Sentry events unchanged', () => {
    const event = {
      type: undefined,
      exception: { values: [{ value: 'Application failed' }] }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps a first-party exception that wraps extension noise', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          { value: EXTENSION_ERROR },
          { value: 'Application failed while sending a message' }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('ignores malformed linked entries while dropping extension noise', () => {
    const event = {
      type: undefined,
      exception: { values: [] }
    } satisfies ErrorEvent
    const throwingException = Object.defineProperty({}, 'value', {
      get: () => {
        throw new Error('blocked value access')
      }
    })
    Reflect.set(event.exception, 'values', [
      null,
      throwingException,
      { value: EXTENSION_ERROR }
    ])

    expect(sentryThirdPartyErrorFilter(event, {})).toBeNull()
  })

  it('keeps the event when inspecting an exception throws', () => {
    const event = { type: undefined } satisfies ErrorEvent
    const originalException = new Proxy(
      {},
      {
        has: () => {
          throw new Error('blocked property access')
        }
      }
    )

    expect(sentryThirdPartyErrorFilter(event, { originalException })).toBe(
      event
    )
  })
})
