/**
 * Backend access reaches the real api object, including pack-defined events.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { createBackendApi } from './backendHandle'
import type { BackendHandle } from './backendHandle'
import { ComfyApiError } from './errors'

describe('backend access', () => {
  let backend: BackendHandle

  beforeEach(() => {
    backend = createBackendApi()
  })

  it('builds a url through the host, not by string concatenation', () => {
    const spy = vi.spyOn(api, 'apiURL').mockReturnValue('/prefix/view?f=a')

    expect(backend.url('/view?f=a')).toBe('/prefix/view?f=a')
    expect(spy).toHaveBeenCalledWith('/view?f=a')
    spy.mockRestore()
  })

  it('refuses a route that is not absolute', () => {
    expect(() => backend.url('view?f=a')).toThrow(ComfyApiError)
  })

  it('reports the current backend session identity', () => {
    const previous = api.clientId
    try {
      api.clientId = 'client-7'
      expect(backend.sessionId()).toBe('client-7')
      api.clientId = undefined
      expect(backend.sessionId()).toBeUndefined()
    } finally {
      api.clientId = previous
    }
  })

  it('delivers a pack-defined event, unparsed', () => {
    const seen: unknown[] = []
    const stop = backend.on('KJNodes.custom', (detail) => seen.push(detail))

    const emit = (step: number) =>
      (api as unknown as EventTarget).dispatchEvent(
        new CustomEvent('KJNodes.custom', { detail: { step } })
      )

    emit(3)
    stop()
    emit(4)

    expect(seen).toEqual([{ step: 3 }])
  })
})

describe('asset urls', () => {
  it('addresses a static file without the /api prefix', () => {
    // `url()` is for the API and prepends /api, so building a pack's own
    // asset through it produced /api/extensions/... and 404'd. Every pack
    // shipping an image, font or HTML page hits this.
    const backend = createBackendApi()

    expect(backend.assetUrl('/extensions/my-pack/icon.png')).not.toContain(
      '/api/'
    )
    expect(backend.assetUrl('/extensions/my-pack/icon.png')).toContain(
      '/extensions/my-pack/icon.png'
    )
  })

  it('still prefixes an API route, so the two are not interchangeable', () => {
    const backend = createBackendApi()
    expect(backend.url('/view?filename=x')).toContain('/api/')
    expect(backend.assetUrl('/view?filename=x')).not.toContain('/api/')
  })

  it('refuses a route that does not start with a slash', () => {
    expect(() => createBackendApi().assetUrl('extensions/x.png')).toThrow(
      ComfyApiError
    )
  })
})

describe('fetch', () => {
  it('goes through the host so the session travels with it', async () => {
    // url() only builds a string; a pack calling window.fetch on it sends an
    // unauthenticated request, which 401s on a hosted install.
    const backend = createBackendApi()
    const spy = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(new Response(null, { status: 200 }))

    await backend.fetch('/my-pack/items', { method: 'POST' })

    expect(spy).toHaveBeenCalledWith('/my-pack/items', { method: 'POST' })
  })

  it('rejects a route that is not API-relative', async () => {
    const backend = createBackendApi()
    expect(() => backend.fetch('my-pack/items')).toThrow(/must start with/)
  })
})
