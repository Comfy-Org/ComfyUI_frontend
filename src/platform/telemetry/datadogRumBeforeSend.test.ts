import { fromPartial } from '@total-typescript/shoehorn'
import type {
  RumActionEvent,
  RumErrorEvent,
  RumLongTaskEvent,
  RumResourceEvent,
  RumViewEvent
} from '@datadog/browser-rum'
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
    error: { message, source, stack },
    view: {
      url: 'https://user:secret@example.com/view?token=private',
      referrer: 'https://user:secret@example.com/referrer?token=private'
    }
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

  it('drops browser-extension messaging noise', () => {
    const event = createErrorEvent(
      'Error: Invalid call to runtime.sendMessage(). Tab not found.'
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

  it('keeps the primary reported error event', () => {
    const event = createErrorEvent(
      '[Reported error]: canvas_layout_listener_failed',
      undefined,
      'custom'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
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

  it('redacts URL secrets from kept error messages and stacks', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = createErrorEvent(
      `failed ${secretUrl}`,
      `at load (${secretUrl})`
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.message).toBe('failed https://example.com/model.glb')
    expect(event.error.stack).toBe('at load (https://example.com/model.glb)')
  })

  it('drops errors when unmodifiable cause fields contain URL metadata', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumErrorEvent>({
      type: 'error',
      error: {
        message: 'failed',
        source: 'source',
        causes: [
          {
            message: `cause ${secretUrl}`,
            source: 'source',
            type: 'Error'
          }
        ]
      },
      view: { url: 'https://example.com/' }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('redacts URL secrets from error resources, page URLs, and event context', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumErrorEvent>({
      type: 'error',
      error: {
        message: 'failed',
        source: 'source',
        resource: { url: secretUrl },
        handling_stack: `at ${secretUrl}`
      },
      view: { url: secretUrl, referrer: secretUrl },
      context: { model: { source: secretUrl } }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.error.resource?.url).toBe('https://example.com/model.glb')
    expect(event.error.handling_stack).toBe('at https://example.com/model.glb')
    expect(event.view).toMatchObject({
      url: 'https://example.com/model.glb',
      referrer: 'https://example.com/model.glb'
    })
    expect(event.context?.model).toEqual({
      source: 'https://example.com/model.glb'
    })
  })

  it('redacts URL secrets from resource events', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumResourceEvent>({
      type: 'resource',
      resource: { url: secretUrl },
      view: { url: secretUrl, referrer: secretUrl },
      context: { model: { source: secretUrl } }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.resource.url).toBe('https://example.com/model.glb')
    expect(event.view).toMatchObject({
      url: 'https://example.com/model.glb',
      referrer: 'https://example.com/model.glb'
    })
    expect(event.context).toEqual({
      model: { source: 'https://example.com/model.glb' }
    })
  })

  it('redacts URL secrets from long-task script sources and invokers', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumLongTaskEvent>({
      type: 'long_task',
      long_task: {
        scripts: [{ source_url: secretUrl, invoker: secretUrl }]
      },
      view: { url: secretUrl, referrer: secretUrl }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.long_task.scripts).toEqual([
      {
        source_url: 'https://example.com/model.glb',
        invoker: 'https://example.com/model.glb'
      }
    ])
  })

  it('redacts URL secrets from action targets', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumActionEvent>({
      type: 'action',
      action: { target: { name: `open ${secretUrl}` } },
      view: { url: secretUrl, referrer: secretUrl }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.action.target?.name).toBe('open https://example.com/model.glb')
  })

  it('redacts URL secrets from the largest-contentful-paint resource', () => {
    const secretUrl = 'https://user:secret@example.com/model.glb?token=private'
    const event = fromPartial<RumViewEvent>({
      type: 'view',
      view: {
        url: secretUrl,
        referrer: secretUrl,
        performance: { lcp: { resource_url: secretUrl } }
      }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
    expect(event.view.performance?.lcp?.resource_url).toBe(
      'https://example.com/model.glb'
    )
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
