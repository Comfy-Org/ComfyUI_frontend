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

  it('drops the console echo of an assertion the reporter also reports', () => {
    const event = createErrorEvent(
      '[Assertion failed]: graph is corrupt',
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
