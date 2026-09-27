import type { ErrorEvent, EventHint } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import {
  isThirdPartyErrorNoise,
  sentryThirdPartyErrorFilter
} from './thirdPartyErrorNoise'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'

describe('third-party error noise', () => {
  it.for([
    EXTENSION_ERROR,
    `Error: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: ${EXTENSION_ERROR}`,
    `Unhandled promise rejection: Error: ${EXTENSION_ERROR}`,
    `${EXTENSION_ERROR} extension context`
  ])('identifies the extension tab error in %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(true)
  })

  it.for([
    'Invalid call to runtime.sendMessage(). Receiving end does not exist.',
    `Application failed: ${EXTENSION_ERROR}`
  ])('does not suppress %s', (message) => {
    expect(isThirdPartyErrorNoise(message)).toBe(false)
  })

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
