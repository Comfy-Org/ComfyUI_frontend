import type { ErrorEvent, EventHint } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

const EXTENSION_ERROR = 'Invalid call to runtime.sendMessage(). Tab not found.'
const appOrigin = window.location.origin

function frameFor(filename: string) {
  return { filename }
}

function minifiedEvent(value: string, stacktraces: unknown[]): ErrorEvent {
  const event: ErrorEvent = { type: undefined, exception: { values: [] } }
  Reflect.set(
    event.exception ?? {},
    'values',
    stacktraces.map((stacktrace) => ({ type: 'Error', value, stacktrace }))
  )
  return event
}

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
    {
      name: 'only same-origin page-URL frames',
      filenames: [`${appOrigin}/cloud/user-check`]
    },
    {
      name: 'only third-party frames',
      filenames: ['https://cdn.example.com/widget.js']
    },
    {
      name: 'a third-party frame with an assets path',
      filenames: ['https://cdn.example.com/assets/widget.js']
    },
    {
      name: 'a browser-extension frame with an assets path',
      filenames: ['chrome-extension://abcdef/assets/index-abc123.js']
    }
  ])('drops a minified message with $name', ({ filenames }) => {
    expect(
      sentryThirdPartyErrorFilter(
        minifiedEvent('pa', [{ frames: filenames.map(frameFor) }]),
        {}
      )
    ).toBeNull()
  })

  it.for([
    { name: 'no stacktrace', stacktrace: undefined },
    { name: 'a null stacktrace', stacktrace: null },
    { name: 'an empty frames list', stacktrace: { frames: [] } },
    { name: 'frames that are not an array', stacktrace: { frames: 'x' } },
    {
      name: 'frames without a parseable filename',
      stacktrace: { frames: [{ filename: '<anonymous>' }, {}] }
    }
  ])('keeps a minified message with $name', ({ stacktrace }) => {
    const event = minifiedEvent('pa', [stacktrace])

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it.for([
    { name: 'a bundled asset', path: '/assets/index-abc123.js' },
    { name: 'a custom node extension', path: '/extensions/my_node/index.js' }
  ])('keeps a minified message with a same-origin $name frame', ({ path }) => {
    const event = minifiedEvent('pa', [
      {
        frames: [
          frameFor('https://cdn.example.com/widget.js'),
          frameFor(appOrigin + path)
        ]
      }
    ])

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps the event when a frame cannot be inspected', () => {
    const throwingFrame = Object.defineProperty({}, 'filename', {
      get: () => {
        throw new Error('blocked filename access')
      }
    })
    const event = minifiedEvent('pa', [
      {
        frames: [frameFor('https://cdn.example.com/widget.js'), throwingFrame]
      }
    ])

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it.for([
    { name: 'a longer message', value: 'Application failed' },
    { name: 'a four-character message', value: 'abcd' },
    { name: 'a message with punctuation', value: 'p a' },
    { name: 'an HTTP status', value: '404' },
    { name: 'a single digit', value: '0' },
    { name: 'a trailing newline', value: 'abc\n' }
  ])('keeps a short-message look-alike with $name', ({ value }) => {
    const event = minifiedEvent(value, [
      { frames: [frameFor('https://cdn.example.com/widget.js')] }
    ])

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps a minified message when a linked exception has a first-party frame', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'pa',
            stacktrace: {
              frames: [frameFor('https://cdn.example.com/widget.js')]
            }
          },
          {
            value: 'ab',
            stacktrace: { frames: [frameFor(`${appOrigin}/assets/app.js`)] }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('keeps the chain when a linked exception has no minified message', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'pa',
            stacktrace: {
              frames: [frameFor('https://cdn.example.com/widget.js')]
            }
          },
          {
            stacktrace: {
              frames: [frameFor('https://cdn.example.com/widget.js')]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBe(event)
  })

  it('drops a chain of minified messages that all have third-party frames', () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          { value: 'pa' },
          {
            value: 'ab',
            stacktrace: {
              frames: [frameFor('https://cdn.example.com/widget.js')]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(sentryThirdPartyErrorFilter(event, {})).toBeNull()
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
