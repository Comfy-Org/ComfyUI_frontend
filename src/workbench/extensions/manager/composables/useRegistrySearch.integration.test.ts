import { until } from '@vueuse/core'
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import { describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

const registryApiClient = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock<unknown>(import('axios'), () => ({
  default: {
    create: () => registryApiClient,
    isAxiosError: () => false
  }
}))

vi.mock(import('algoliasearch/dist/lite/builds/browser'), () => ({
  liteClient: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'))

function goOffline() {
  vi.mocked(algoliasearch, { partial: true }).mockReturnValue({
    search: vi.fn().mockRejectedValue(new Error('Algolia unreachable'))
  })
  registryApiClient.get.mockRejectedValue(new Error('Network Error'))
}

async function searchFor(query: string) {
  const search = useRegistrySearch({ query, searchMode: 'packs' })
  await until(search.isLoading).toBe(false)
  return search
}

describe('useRegistrySearch through the real search gateway', () => {
  it.for(['gguf', ''])(
    'fails the search for %j when Algolia and the registry are unreachable',
    async (query) => {
      goOffline()

      const search = await searchFor(query)

      expect(search.firstPage.value).toEqual({ status: 'failed', query })
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'error_searching_registry_packs' })
      )
    }
  )

  it('asks the registry again after a failed search instead of reusing the failure', async () => {
    goOffline()
    await searchFor('gguf')
    registryApiClient.get.mockResolvedValue({
      data: { nodes: [{ id: 'gguf-pack' }] }
    })

    const search = await searchFor('gguf')

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })
    expect(toValue(search.items)).toEqual([{ id: 'gguf-pack' }])
  })
})
