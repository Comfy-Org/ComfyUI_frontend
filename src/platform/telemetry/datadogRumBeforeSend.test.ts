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

describe('rumBeforeSend', () => {
  it('drops known third-party network noise', () => {
    const event = createErrorEvent(
      'Failed to fetch https://px.ads.linkedin.com/pixel'
    )

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('drops resource load failures from origins we do not control', () => {
    const event = fromPartial<RumErrorEvent>({
      type: 'error',
      error: {
        message: '[resource:loadError]',
        source: 'source',
        resource: { url: 'https://connect.facebook.net/en_US/fbevents.js' }
      }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(false)
  })

  it('keeps resource load failures from our own origin', () => {
    const event = fromPartial<RumErrorEvent>({
      type: 'error',
      error: {
        message: '[resource:loadError]',
        source: 'source',
        resource: { url: 'https://cloud.comfy.org/assets/app.js' }
      }
    })

    expect(rumBeforeSend(event, fromPartial({}))).toBe(true)
  })

  it('keeps a runtime error thrown by a third-party script', () => {
    const event = createErrorEvent(
      'gtag is not a function',
      'at push (https://www.googletagmanager.com/gtm.js:1:2)'
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
