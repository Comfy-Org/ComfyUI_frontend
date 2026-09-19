import { fromPartial } from '@total-typescript/shoehorn'
import type { RumErrorEvent } from '@datadog/browser-rum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAssertReporter } from '@/base/assert'

import { classifyRumErrorOrigin, rumBeforeSend } from './datadogRumBeforeSend'

function createErrorEvent(
  message: string,
  stack?: string,
  source: RumErrorEvent['error']['source'] = 'source'
): RumErrorEvent {
  return fromPartial<RumErrorEvent>({
    type: 'error',
    error: { message, source, stack }
  })
}

const FIREBASE_ASSERTION =
  '@firebase/auth: Auth (11.10.0): INTERNAL ASSERTION FAILED: Pending promise was never set'
const FIREBASE_FINGERPRINT = 'firebase-auth-pending-promise'

describe('rumBeforeSend', () => {
  beforeEach(() => {
    setAssertReporter(vi.fn(), { forwardsToRum: true })
  })

  afterEach(() => {
    setAssertReporter(null)
  })

  it('drops known third-party network noise', () => {
    const event = createErrorEvent(
      'Failed to fetch https://px.ads.linkedin.com/pixel'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it.for([
    [
      'a Chrome touchmove intervention',
      'intervention: Ignored attempt to cancel a touchmove event, cancelable=false'
    ],
    [
      'a Chrome WebMediaPlayer intervention',
      'intervention: Blocked attempt to create a WebMediaPlayer as there are too many WebMediaPlayers already in existence'
    ],
    [
      'a ResizeObserver loop warning',
      'ResizeObserver loop completed with undelivered notifications.'
    ],
    [
      'a failed <img> load surfaced as an uncaught event',
      'Uncaught {"isTrusted":true,"target":"HTMLImageElement"}'
    ],
    [
      'the PostHog client rate-limit notice',
      '[PostHog.js] This capture call is ignored due to client rate limiting'
    ]
  ])('drops non-actionable browser/environment noise: %s', ([, message]) => {
    const event = createErrorEvent(message)

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it.for([
    [
      'a drawImage TypeError naming HTMLImageElement in its overload list',
      "Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The provided value is not of type '(CSSImageValue or HTMLImageElement or SVGImageElement or HTMLVideoElement or HTMLCanvasElement or ImageBitmap or OffscreenCanvas or VideoFrame)'"
    ],
    [
      'a texImage2D TypeError naming HTMLImageElement in its overload list',
      "Failed to execute 'texImage2D' on 'WebGL2RenderingContext': The provided value is not of type '(HTMLImageElement or HTMLCanvasElement or HTMLVideoElement or ImageBitmap or ImageData or OffscreenCanvas or VideoFrame)'"
    ],
    [
      'a deliberate report whose text mentions HTMLImageElement',
      'Thumbnail decode failed for an HTMLImageElement supplied by the node pack'
    ]
  ])(
    'keeps first-party errors that merely name a matched noise term: %s',
    ([, message]) => {
      // These carry a matched substring ('HTMLImageElement') but not the
      // `Uncaught {…}` shape the resource-load matcher targets, so the
      // anchored predicate must let them through. An unanchored
      // `includes('HTMLImageElement')` drops all three — that is the
      // regression this case exists to catch.
      const event = createErrorEvent(
        message,
        'at render (https://cloud.comfy.org/assets/app.js:1:2)'
      )

      expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    }
  )

  it('still drops the uncaught-event shape the img matcher targets', () => {
    // The other half of the pair above: anchoring must not stop the matcher
    // from catching the noise it was written for.
    const event = createErrorEvent(
      'Uncaught {"isTrusted":true,"target":"HTMLImageElement"}',
      'at render (https://cloud.comfy.org/assets/app.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('drops the console echo of an assertion the reporter also reports', () => {
    const event = createErrorEvent(
      '[Assertion failed]: graph is corrupt',
      undefined,
      'console'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('drops the console echo of an error reportError already sent', () => {
    const event = createErrorEvent(
      '[Reported error]: canvas_layout_listener_failed Error: listener failed',
      undefined,
      'console'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('keeps the reported copy of an assertion failure', () => {
    const event = createErrorEvent(
      '[Assertion failed]: graph is corrupt',
      undefined,
      'custom'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps ordinary console errors that are not assertion failures', () => {
    const event = createErrorEvent('Application failed', undefined, 'console')

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps the console copy while no reporter exists to replace it', () => {
    setAssertReporter(null)
    const event = createErrorEvent(
      '[Assertion failed]: fired before boot finished',
      undefined,
      'console'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps the console copy when the installed reporter does not forward to RUM', () => {
    setAssertReporter(vi.fn())
    const event = createErrorEvent(
      '[Assertion failed]: handled by another telemetry sink',
      undefined,
      'console'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
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

  it('groups Firebase pending-promise errors without rewriting them', () => {
    for (const message of [
      `[2026-08-27T20:58:34.782Z]  ${FIREBASE_ASSERTION}`,
      `[2026-08-27T20:58:34.783Z]  ${FIREBASE_ASSERTION}`,
      'INTERNAL ASSERTION FAILED: Pending promise was never set'
    ]) {
      const event = createErrorEvent(message)

      expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
      expect(event.error).toMatchObject({
        message,
        fingerprint: FIREBASE_FINGERPRINT
      })
    }
  })

  it('does not fingerprint unrelated timestamped errors', () => {
    const message = '[2026-08-27T20:58:34.782Z]  some-extension: it broke'
    const event = createErrorEvent(message)

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe(message)
    expect(event.error.fingerprint).toBeUndefined()
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
