import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import {
  httpSupportsModelTypeTags,
  refreshSupportsModelTypeTags,
  useSupportsModelTypeTagsRefresh
} from '@/platform/assets/composables/useModelTypeTagsRefresh'
import { api } from '@/scripts/api'

function buildResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response
}

const fetchApiSpy = vi.spyOn(api, 'fetchApi')

beforeEach(() => {
  vi.clearAllMocks()
  httpSupportsModelTypeTags.value = undefined
})

describe('refreshSupportsModelTypeTags', () => {
  it('reads the flag from the raw /features response', async () => {
    fetchApiSpy.mockResolvedValue(
      buildResponse({ supports_model_type_tags: true })
    )

    await refreshSupportsModelTypeTags()

    expect(fetchApiSpy).toHaveBeenCalledWith('/features', {
      cache: 'no-store'
    })
    expect(httpSupportsModelTypeTags.value).toBe(true)
  })

  it('tracks a flip to false', async () => {
    httpSupportsModelTypeTags.value = true
    fetchApiSpy.mockResolvedValue(
      buildResponse({ supports_model_type_tags: false })
    )

    await refreshSupportsModelTypeTags()

    expect(httpSupportsModelTypeTags.value).toBe(false)
  })

  it('clears the value when the backend stops serving the key', async () => {
    httpSupportsModelTypeTags.value = true
    fetchApiSpy.mockResolvedValue(buildResponse({ other_flag: true }))

    await refreshSupportsModelTypeTags()

    expect(httpSupportsModelTypeTags.value).toBeUndefined()
  })

  it('ignores a non-boolean value', async () => {
    fetchApiSpy.mockResolvedValue(
      buildResponse({ supports_model_type_tags: 'yes' })
    )

    await refreshSupportsModelTypeTags()

    expect(httpSupportsModelTypeTags.value).toBeUndefined()
  })

  it('keeps the last known value on an error response', async () => {
    httpSupportsModelTypeTags.value = true
    fetchApiSpy.mockResolvedValue(buildResponse({}, { ok: false, status: 500 }))

    await refreshSupportsModelTypeTags()

    expect(httpSupportsModelTypeTags.value).toBe(true)
  })

  it('keeps the last known value when the fetch fails', async () => {
    httpSupportsModelTypeTags.value = false
    fetchApiSpy.mockRejectedValue(new Error('offline'))

    await refreshSupportsModelTypeTags()

    expect(httpSupportsModelTypeTags.value).toBe(false)
  })
})

describe('useSupportsModelTypeTagsRefresh', () => {
  let scope: EffectScope

  beforeEach(() => {
    fetchApiSpy.mockResolvedValue(
      buildResponse({ supports_model_type_tags: true })
    )
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  it('fetches immediately and again on websocket reconnect', async () => {
    scope.run(() => useSupportsModelTypeTagsRefresh())
    expect(fetchApiSpy).toHaveBeenCalledTimes(1)

    api.dispatchCustomEvent('reconnected')

    expect(fetchApiSpy).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(httpSupportsModelTypeTags.value).toBe(true))
  })

  it('re-fetches when the tab becomes visible again', () => {
    scope.run(() => useSupportsModelTypeTagsRefresh())
    expect(fetchApiSpy).toHaveBeenCalledTimes(1)

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetchApiSpy).toHaveBeenCalledTimes(2)
  })

  it('re-fetches on the polling interval', () => {
    vi.useFakeTimers()
    scope.run(() => useSupportsModelTypeTagsRefresh())
    expect(fetchApiSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(120_000)
    expect(fetchApiSpy).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(120_000)
    expect(fetchApiSpy).toHaveBeenCalledTimes(3)
  })

  it('stops all refresh triggers when the scope is disposed', () => {
    vi.useFakeTimers()
    scope.run(() => useSupportsModelTypeTagsRefresh())
    expect(fetchApiSpy).toHaveBeenCalledTimes(1)

    scope.stop()
    api.dispatchCustomEvent('reconnected')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(120_000)

    expect(fetchApiSpy).toHaveBeenCalledTimes(1)
  })
})
