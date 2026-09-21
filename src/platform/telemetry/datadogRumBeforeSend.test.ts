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

  it('drops fetch failures to the RUM intake itself (adblocker noise)', () => {
    const event = createErrorEvent(
      'Failed to fetch https://browser-intake-us5-datadoghq.com/api/v2/rum'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('drops the CSP block of a third-party tracking pixel by host', () => {
    // Give it a FIRST-PARTY stack on purpose: the blocked URI is what makes
    // this noise, so the case must fail if the host rule stops firing rather
    // than pass by accident on a missing stack.
    const event = createErrorEvent(
      "csp_violation: 'https://www.facebook.com/tr/' blocked by 'form-action' directive",
      'at submit (https://cloud.comfy.org/assets/app.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('drops a CSP violation whose blocked URI carries no host but whose frame is a known tracker', () => {
    // e.g. a `blob` script injected by an ad script the CSP correctly blocks.
    // The report's stack points at the offending third-party sourceFile.
    const event = createErrorEvent(
      "csp_violation: 'blob' blocked by 'script-src-elem' directive",
      'at eval (https://connect.facebook.net/en_US/fbevents.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('keeps an unattributable CSP violation instead of assuming third party', () => {
    // No stack is the NORMAL shape of a first-party report: markup-initiated
    // blocks (img-src, font-src, linked style-src, inline <script>) carry no
    // sourceFile, so the SDK builds no stack. Dropping these loses exactly the
    // first-party CSP defects this filter promises to keep.
    const event = createErrorEvent(
      "csp_violation: 'blob' blocked by 'script-src-elem' directive"
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps a CSP violation that blocks a required third-party dependency', () => {
    // A CSP tightening that breaks a CDN script, font, or auth/payment SDK is a
    // real functional regression and presents as a third-party stack, so an
    // origin-based drop would hide it.
    const event = createErrorEvent(
      "csp_violation: 'https://cdn.jsdelivr.net/npm/some-dep/dist/index.js' blocked by 'script-src' directive",
      'at load (https://cdn.jsdelivr.net/npm/some-dep/dist/index.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps an error that merely quotes the csp_violation token', () => {
    // Genuine SDK reports are PREFIXED `csp_violation:`; an unanchored test
    // also swallows a console echo or a message embedding user-supplied text.
    const event = createErrorEvent(
      'Failed to parse report body: csp_violation: unexpected token'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps a violation naming a lookalike of a noise host', () => {
    // Hostname is parsed and compared, so `notfacebook.com` is not
    // `facebook.com` and a noise host sitting in a query parameter does not
    // suppress a first-party report.
    const event = createErrorEvent(
      "csp_violation: 'https://notfacebook.com/tr/' blocked by 'script-src' directive"
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps a first-party fetch failure whose URL carries a noise host in a query param', () => {
    const event = createErrorEvent(
      'Failed to fetch https://cloud.comfy.org/api/redirect?next=https%3A%2F%2Ffacebook.com%2Ftr'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps a first-party CSP violation so it can be fixed in the CSP', () => {
    const event = createErrorEvent(
      "csp_violation: 'blob' blocked by 'script-src-elem' directive",
      'at makeWorker (https://cloud.comfy.org/assets/app.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps an extension-origin CSP violation (scoped to third party only)', () => {
    const event = createErrorEvent(
      "csp_violation: 'blob' blocked by 'script-src-elem' directive",
      'at run (https://cloud.comfy.org/extensions/comfyui-foo/main.js:1:2)'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
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
