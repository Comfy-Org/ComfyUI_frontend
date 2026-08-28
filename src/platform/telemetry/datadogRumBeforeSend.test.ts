import { fromPartial } from '@total-typescript/shoehorn'
import type { RumErrorEvent } from '@datadog/browser-rum'
import { describe, expect, it } from 'vitest'

import { classifyRumErrorOrigin, rumBeforeSend } from './datadogRumBeforeSend'

function createErrorEvent(message: string, stack?: string): RumErrorEvent {
  return fromPartial<RumErrorEvent>({
    type: 'error',
    error: { message, source: 'source', stack }
  })
}

const FIREBASE_ASSERTION =
  '@firebase/auth: Auth (11.10.0): INTERNAL ASSERTION FAILED: Pending promise was never set'

describe('rumBeforeSend', () => {
  it('drops known third-party network noise', () => {
    const event = createErrorEvent(
      'Failed to fetch https://px.ads.linkedin.com/pixel'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('keeps application errors and tags their origin', () => {
    const event = createErrorEvent(
      'Application failed',
      'at render (https://cloud.comfy.org/assets/app.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.context).toEqual({ error: { origin: 'first_party' } })
  })

  it('tags custom extension errors with their folder', () => {
    const event = createErrorEvent(
      'Extension failed',
      'at run (https://cloud.comfy.org/extensions/comfyui-foo/main.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.context).toEqual({
      error: { origin: 'extension', extension: 'comfyui-foo' }
    })
  })

  it('strips the timestamp Firebase prepends so repeats share one signature', () => {
    const messages = [
      `[2026-08-27T20:58:34.782Z]  ${FIREBASE_ASSERTION}`,
      `[2026-08-27T20:58:34.783Z]  ${FIREBASE_ASSERTION}`,
      `[2026-08-27T21:05:17.838Z]  ${FIREBASE_ASSERTION}`
    ].map((message) => {
      const event = createErrorEvent(message)
      expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
      return event.error.message
    })

    expect(new Set(messages)).toEqual(new Set([FIREBASE_ASSERTION]))
  })

  it('leaves messages without a timestamp prefix untouched', () => {
    const event = createErrorEvent(
      'INTERNAL ASSERTION FAILED: Pending promise was never set'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe(
      'INTERNAL ASSERTION FAILED: Pending promise was never set'
    )
  })

  it('only strips a timestamp at the start of the message', () => {
    const event = createErrorEvent(
      `Upload expired at [2026-08-27T20:58:34.782Z] and was retried`
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe(
      'Upload expired at [2026-08-27T20:58:34.782Z] and was retried'
    )
  })

  it('leaves a timestamped message from any other logger untouched', () => {
    const message = '[2026-08-27T20:58:34.782Z]  some-extension: it broke'
    const event = createErrorEvent(message)

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe(message)
  })

  it('never empties a message that is only a timestamp', () => {
    const message = '[2026-08-27T20:58:34.782Z]'
    const event = createErrorEvent(message)

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe(message)
  })
})

describe('classifyRumErrorOrigin', () => {
  it('uses the first recognizable in-app stack frame', () => {
    const stack = [
      'at external (https://cdn.example.com/library.js:1:2)',
      'at cloud (https://cloud.comfy.org/extensions/cloud/main.js:1:2)',
      'at custom (https://cloud.comfy.org/extensions/comfyui-foo/main.js:1:2)'
    ].join('\n')

    expect(classifyRumErrorOrigin(stack)).toEqual({ origin: 'first_party' })
  })

  it('classifies stacks without in-app frames as third party', () => {
    expect(
      classifyRumErrorOrigin('at external (https://cdn.example.com/app.js:1:2)')
    ).toEqual({ origin: 'third_party' })
  })
})
