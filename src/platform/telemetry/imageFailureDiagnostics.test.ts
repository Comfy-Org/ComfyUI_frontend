import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  describeImageLoadFailure,
  resetImageFailureProbesForTest
} from '@/platform/telemetry/imageFailureDiagnostics'

const ORIGIN = 'https://cloud.comfy.org'

function respondWith(status: number) {
  return vi.fn().mockResolvedValue({ status, type: 'basic', body: null })
}

describe('describeImageLoadFailure', () => {
  beforeEach(() => {
    resetImageFailureProbesForTest()
    vi.stubGlobal('location', new URL(`${ORIGIN}/`))
  })

  it('reports the status the img error event withheld', async () => {
    vi.stubGlobal('fetch', respondWith(401))

    const result = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png&type=output`
    )

    expect(result.status).toBe(401)
    expect(result.probe_outcome).toBe('probed')
  })

  it('separates a missing output from a missing template', async () => {
    vi.stubGlobal('fetch', respondWith(404))

    const output = await describeImageLoadFailure(
      `${ORIGIN}/api/view?type=output&filename=${'a'.repeat(64)}.png`
    )
    const template = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=template-Magazine_Cover.png`
    )

    expect(output).toMatchObject({
      status: 404,
      resource_kind: 'output',
      filename_kind: 'content_hash'
    })
    expect(template).toMatchObject({
      status: 404,
      resource_kind: 'unspecified',
      filename_kind: 'template'
    })
  })

  it('probes with credentials, or it would manufacture the 401 it measures', async () => {
    const fetchSpy = respondWith(200)
    vi.stubGlobal('fetch', fetchSpy)

    await describeImageLoadFailure(`${ORIGIN}/api/view?filename=a.png`)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
        headers: { Range: 'bytes=0-0' }
      })
    )
  })

  it('records a network failure as an outcome rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    const result = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png`
    )

    expect(result.probe_outcome).toBe('probe_failed')
    expect(result.status).toBeUndefined()
  })

  it('caps probes so a node retrying one missing file cannot amplify', async () => {
    const fetchSpy = respondWith(404)
    vi.stubGlobal('fetch', fetchSpy)

    const results = []
    for (let i = 0; i < 25; i++) {
      results.push(
        await describeImageLoadFailure(`${ORIGIN}/api/view?filename=a.png`)
      )
    }

    expect(fetchSpy).toHaveBeenCalledTimes(20)
    expect(results.at(-1)?.probe_outcome).toBe('probe_capped')
    // The report still lands — a capped probe must not silence the event.
    expect(results.at(-1)?.source).toBe('node_image_preview')
  })

  it('does not probe cross-origin urls, which would report our own opacity', async () => {
    const fetchSpy = respondWith(200)
    vi.stubGlobal('fetch', fetchSpy)

    const result = await describeImageLoadFailure(
      'https://cdn.example.com/a.png'
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.same_origin).toBe(false)
    expect(result.probe_outcome).toBe('probe_blocked')
  })

  it('reports an unparseable src instead of fabricating url shape fields', async () => {
    const fetchSpy = respondWith(200)
    vi.stubGlobal('fetch', fetchSpy)

    const result = await describeImageLoadFailure('')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.probe_outcome).toBe('invalid_src')
  })

  it('reports a redirect as a redirect, not as our own status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ status: 0, type: 'opaqueredirect', body: null })
    )

    const result = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png`
    )

    expect(result.probe_outcome).toBe('probe_redirected')
    expect(result.status).toBeUndefined()
  })

  it('does not follow redirects — a signed storage URL answers on its own terms', async () => {
    const fetchSpy = respondWith(200)
    vi.stubGlobal('fetch', fetchSpy)

    await describeImageLoadFailure(`${ORIGIN}/api/view?filename=a.png`)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'manual' })
    )
  })

  it('survives a body cancel that rejects, rather than raising an unhandled rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 404,
        type: 'basic',
        body: { cancel: () => Promise.reject(new TypeError('already errored')) }
      })
    )

    const result = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png`
    )

    expect(result).toMatchObject({ status: 404, probe_outcome: 'probed' })
  })

  it('emits the report rather than holding it for a probe while the page unloads', async () => {
    // A probe that never settles: without the unload race this await hangs and
    // the failure is never reported.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    const pending = describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png`
    )
    window.dispatchEvent(new Event('pagehide'))

    await expect(pending).resolves.toMatchObject({
      source: 'node_image_preview',
      probe_outcome: 'probe_abandoned'
    })
  })

  it('drops the unload listener once the race settles, on every failure', async () => {
    vi.stubGlobal('fetch', respondWith(404))
    // Observes registration without replacing it, so the listeners under test
    // are the real ones the DOM holds — a mocked implementation would register
    // nothing and the teardown assertion below would pass vacuously.
    const addSpy = vi.spyOn(window, 'addEventListener')

    for (let i = 0; i < 3; i++) {
      await describeImageLoadFailure(`${ORIGIN}/api/view?filename=a${i}.png`)
    }

    const signals = addSpy.mock.calls
      .filter(([type]) => type === 'pagehide')
      .map(([, , options]) => (options as AddEventListenerOptions).signal)
    addSpy.mockRestore()

    expect(signals).toHaveLength(3)
    // Every listener is torn down, so repeated failures cannot accumulate them.
    expect(signals.every((signal) => signal?.aborted)).toBe(true)
  })

  it('carries page age, the field that distinguishes auth expiry from a 404', async () => {
    vi.stubGlobal('fetch', respondWith(401))
    vi.spyOn(performance, 'now').mockReturnValue(7_500_000)

    const result = await describeImageLoadFailure(
      `${ORIGIN}/api/view?filename=a.png`
    )

    expect(result.page_age_ms).toBe(7_500_000)
  })
})
