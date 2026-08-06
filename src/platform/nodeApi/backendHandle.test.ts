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
