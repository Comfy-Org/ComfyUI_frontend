import { until } from '@vueuse/core'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

const registryAdapter = await vi.hoisted(async () => {
  const { default: axios } = await import('axios')
  const adapter = vi.fn<AxiosAdapter>()
  axios.defaults.adapter = adapter
  return adapter
})

vi.mock(import('algoliasearch/dist/lite/builds/browser'), () => ({
  liteClient: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'))

function goOffline() {
  vi.mocked(algoliasearch, { partial: true }).mockReturnValue({
    search: vi.fn().mockRejectedValue(new Error('Algolia unreachable'))
  })
  registryAdapter.mockRejectedValue(new Error('Network Error'))
}

async function searchFor(query: string) {
  const search = useRegistrySearch({ query, searchMode: 'packs' })
  await until(search.isLoading).toBe(false)
  return search
}

describe('useRegistrySearch through the real search gateway', () => {
  it.for(['gguf', ''])(
    'fails the search for %j and reports the registry error when Algolia and the registry are unreachable',
    async (query) => {
      goOffline()

      const search = await searchFor(query)

      expect(search.firstPage.value).toEqual({ status: 'failed', query })
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: expect.stringContaining('Network Error'),
          errors: [
            expect.objectContaining({ message: 'Algolia unreachable' }),
            expect.objectContaining({
              message: expect.stringContaining('Network Error')
            })
          ]
        }),
        expect.objectContaining({ errorType: 'error_searching_registry_packs' })
      )
    }
  )

  it('serves registry results when Algolia returns a malformed response', async () => {
    vi.mocked(algoliasearch, { partial: true }).mockReturnValue({
      search: vi.fn().mockResolvedValue({ results: [] })
    })
    registryAdapter.mockImplementation(async (config) => ({
      data: { nodes: [{ id: 'registry-pack' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }))

    const search = await searchFor('malformed')

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })
    expect(toValue(search.items)).toEqual([{ id: 'registry-pack' }])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('fails the search and reports the error when Algolia is unreachable and the registry returns a malformed response', async () => {
    goOffline()
    registryAdapter.mockImplementation(async (config) => ({
      data: { nodes: {} },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }))

    const search = await searchFor('malformed')

    expect(search.firstPage.value).toEqual({
      status: 'failed',
      query: 'malformed'
    })
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: expect.stringContaining('Malformed registry search response')
      }),
      expect.objectContaining({ errorType: 'error_searching_registry_packs' })
    )

    registryAdapter.mockImplementation(async (config) => ({
      data: { nodes: [{ id: 'registry-pack' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }))
    await search.loadNew()

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })
    expect(toValue(search.items)).toEqual([{ id: 'registry-pack' }])
  })

  it('asks the registry again after a failed search instead of reusing the failure', async () => {
    goOffline()
    await searchFor('gguf')
    registryAdapter.mockImplementation(async (config) => ({
      data: { nodes: [{ id: 'gguf-pack' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }))

    const search = await searchFor('gguf')

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })
    expect(toValue(search.items)).toEqual([{ id: 'gguf-pack' }])
  })
})
