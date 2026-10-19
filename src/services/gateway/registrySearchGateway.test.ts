import { assert, describe, expect, it, vi } from 'vitest'

import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'
import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import type {
  SearchPacksOutcome,
  SearchPacksResult
} from '@/types/searchServiceTypes'

vi.mock(import('@/services/providers/algoliaSearchProvider'))
vi.mock(import('@/services/providers/registrySearchProvider'))

const succeeded = (result: SearchPacksResult): SearchPacksOutcome => ({
  ok: true,
  result
})

const failed = (message: string): SearchPacksOutcome => ({
  ok: false,
  cause: new Error(message)
})

const failedWith = (message: string) => ({
  ok: false,
  cause: expect.objectContaining({
    message: expect.stringContaining(message)
  })
})

describe('useRegistrySearchGateway', () => {
  describe('Provider initialization', () => {
    it('should initialize with both providers', () => {
      const mockAlgoliaProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      expect(useAlgoliaSearchProvider).toHaveBeenCalled()
      expect(useComfyRegistrySearchProvider).toHaveBeenCalled()
      expect(gateway).toBeDefined()
    })

    it('should handle Algolia initialization failure gracefully', () => {
      vi.mocked(useAlgoliaSearchProvider).mockImplementation(() => {
        throw new Error('Algolia init failed')
      })

      const mockRegistryProvider = {
        searchPacks: vi
          .fn()
          .mockResolvedValue(
            succeeded({ nodePacks: [], querySuggestions: [] })
          ),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      return expect(
        gateway.searchPacks('test', { pageSize: 10, pageNumber: 0 })
      ).resolves.toEqual(succeeded({ nodePacks: [], querySuggestions: [] }))
    })
  })

  describe('Search functionality', () => {
    it('should use Algolia provider by default and fallback on failure', async () => {
      const algoliaResult = {
        nodePacks: [{ id: 'algolia-1', name: 'Algolia Pack' }],
        querySuggestions: []
      }
      const registryResult = {
        nodePacks: [{ id: 'registry-1', name: 'Registry Pack' }],
        querySuggestions: []
      }

      const mockAlgoliaProvider = {
        searchPacks: vi
          .fn()
          .mockResolvedValueOnce(succeeded(algoliaResult))
          .mockResolvedValueOnce(failed('Algolia failed')),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn().mockResolvedValue(succeeded(registryResult)),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      await expect(
        gateway.searchPacks('test', { pageSize: 10, pageNumber: 0 })
      ).resolves.toEqual(succeeded(algoliaResult))
      await expect(
        gateway.searchPacks('test', { pageSize: 10, pageNumber: 0 })
      ).resolves.toEqual(succeeded(registryResult))
    })

    it('fails the search with every provider error when all providers fail', async () => {
      const algoliaError = new Error('Algolia failed')
      const registryError = new Error('Registry failed')
      const mockAlgoliaProvider = {
        searchPacks: vi
          .fn()
          .mockResolvedValue({ ok: false, cause: algoliaError }),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi
          .fn()
          .mockResolvedValue({ ok: false, cause: registryError }),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      const outcome = await gateway.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      assert(!outcome.ok, 'expected the search to fail')
      expect(outcome.cause).toBeInstanceOf(AggregateError)
      expect(outcome.cause).toMatchObject({
        message: 'All search providers failed. Last error: Registry failed',
        errors: [algoliaError, registryError]
      })
    })
  })

  describe('provider fallback', () => {
    it('should switch to fallback provider after failure and log warnings', async () => {
      const registryResult = {
        nodePacks: [{ id: 'registry-1', name: 'Registry Pack' }],
        querySuggestions: []
      }

      const mockAlgoliaProvider = {
        searchPacks: vi.fn().mockResolvedValue(failed('Algolia failed')),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn().mockResolvedValue(succeeded(registryResult)),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      const outcome = await gateway.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(mockAlgoliaProvider.searchPacks).toHaveBeenCalledTimes(1)
      expect(mockRegistryProvider.searchPacks).toHaveBeenCalledTimes(1)
      expect(outcome).toEqual(succeeded(registryResult))
    })
  })

  describe('circuit breaker', () => {
    const params = { pageSize: 10, pageNumber: 0 }

    function failingProvider() {
      return {
        searchPacks: vi.fn().mockResolvedValue(failed('unreachable')),
        clearSearchCache: vi.fn()
      }
    }

    it('asks each provider at most once per search', async () => {
      const algolia = failingProvider()
      const registry = failingProvider()
      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(algolia)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(registry)
      const gateway = useRegistrySearchGateway()

      await expect(gateway.searchPacks('test', params)).resolves.toEqual(
        failedWith('unreachable')
      )
      await expect(gateway.searchPacks('test', params)).resolves.toEqual(
        failedWith('unreachable')
      )

      expect(algolia.searchPacks).toHaveBeenCalledTimes(2)
      expect(registry.searchPacks).toHaveBeenCalledTimes(2)
    })

    it('retries an open circuit a minute after its last real attempt, however often the user searches meanwhile', async () => {
      vi.useFakeTimers()
      vi.mocked(useAlgoliaSearchProvider).mockImplementation(() => {
        throw new Error('Algolia init failed')
      })
      const registry = failingProvider()
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(registry)
      const gateway = useRegistrySearchGateway()
      for (let i = 0; i < 3; i++) {
        await expect(gateway.searchPacks('test', params)).resolves.toEqual(
          failedWith('unreachable')
        )
      }

      vi.advanceTimersByTime(30_000)
      await expect(gateway.searchPacks('test', params)).resolves.toEqual(
        failedWith('No available search providers')
      )
      registry.searchPacks.mockResolvedValue(
        succeeded({ nodePacks: [], querySuggestions: [] })
      )
      vi.advanceTimersByTime(30_001)

      await expect(gateway.searchPacks('test', params)).resolves.toEqual(
        succeeded({ nodePacks: [], querySuggestions: [] })
      )
      expect(registry.searchPacks).toHaveBeenCalledTimes(4)
    })

    it('asks providers with open circuits again after the circuits are reset', async () => {
      const algolia = failingProvider()
      const registry = failingProvider()
      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(algolia)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(registry)
      const gateway = useRegistrySearchGateway()
      for (let i = 0; i < 3; i++) await gateway.searchPacks('test', params)
      algolia.searchPacks.mockResolvedValue(
        succeeded({ nodePacks: [{ id: 'recovered' }], querySuggestions: [] })
      )

      gateway.resetCircuits()

      await expect(gateway.searchPacks('test', params)).resolves.toEqual(
        succeeded({ nodePacks: [{ id: 'recovered' }], querySuggestions: [] })
      )
      expect(algolia.searchPacks).toHaveBeenCalledTimes(4)
    })
  })

  describe('pagination', () => {
    const page = (pageNumber: number) => ({ pageSize: 10, pageNumber })
    const onePackPage = (id: string) =>
      succeeded({ nodePacks: [{ id }], querySuggestions: [] })

    it.for([
      {
        servedBy: 'registry',
        algoliaOutcomes: [failed('Algolia blip'), onePackPage('algolia-2')],
        registryOutcomes: [onePackPage('registry-1'), failed('Registry blip')],
        calls: { algolia: 1, registry: 2 }
      },
      {
        servedBy: 'Algolia',
        algoliaOutcomes: [onePackPage('algolia-1'), failed('Algolia blip')],
        registryOutcomes: [onePackPage('registry-2')],
        calls: { algolia: 2, registry: 0 }
      }
    ])(
      'fails a later page instead of filling it from another provider when $servedBy served the first page',
      async ({ algoliaOutcomes, registryOutcomes, calls }) => {
        const algolia = {
          searchPacks: vi.fn<() => Promise<SearchPacksOutcome>>(),
          clearSearchCache: vi.fn()
        }
        const registry = {
          searchPacks: vi.fn<() => Promise<SearchPacksOutcome>>(),
          clearSearchCache: vi.fn()
        }
        for (const outcome of algoliaOutcomes)
          algolia.searchPacks.mockResolvedValueOnce(outcome)
        for (const outcome of registryOutcomes)
          registry.searchPacks.mockResolvedValueOnce(outcome)
        vi.mocked(useAlgoliaSearchProvider).mockReturnValue(algolia)
        vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(registry)
        const gateway = useRegistrySearchGateway()

        await expect(gateway.searchPacks('gguf', page(0))).resolves.toEqual(
          expect.objectContaining({ ok: true })
        )
        await expect(gateway.searchPacks('gguf', page(1))).resolves.toEqual(
          failedWith('blip')
        )

        expect(algolia.searchPacks).toHaveBeenCalledTimes(calls.algolia)
        expect(registry.searchPacks).toHaveBeenCalledTimes(calls.registry)
      }
    )

    it('fails over on the first page of a new query after an earlier list was served by one provider', async () => {
      const algolia = {
        searchPacks: vi
          .fn<() => Promise<SearchPacksOutcome>>()
          .mockResolvedValueOnce(onePackPage('algolia-1'))
          .mockResolvedValueOnce(failed('Algolia blip')),
        clearSearchCache: vi.fn()
      }
      const registry = {
        searchPacks: vi
          .fn<() => Promise<SearchPacksOutcome>>()
          .mockResolvedValue(onePackPage('registry-1')),
        clearSearchCache: vi.fn()
      }
      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(algolia)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(registry)
      const gateway = useRegistrySearchGateway()
      await gateway.searchPacks('gguf', page(0))

      await expect(gateway.searchPacks('flux', page(0))).resolves.toEqual(
        onePackPage('registry-1')
      )
    })
  })

  describe('Cache management', () => {
    it('should clear cache for all providers', () => {
      const mockAlgoliaProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()
      gateway.clearSearchCache()

      expect(mockAlgoliaProvider.clearSearchCache).toHaveBeenCalled()
      expect(mockRegistryProvider.clearSearchCache).toHaveBeenCalled()
    })

    it('should handle cache clear failures gracefully', () => {
      const mockAlgoliaProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn().mockImplementation(() => {
          throw new Error('Cache clear failed')
        })
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn(),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      expect(() => gateway.clearSearchCache()).not.toThrow()

      expect(mockAlgoliaProvider.clearSearchCache).toHaveBeenCalled()
      expect(mockRegistryProvider.clearSearchCache).toHaveBeenCalled()
    })
  })

  describe('Provider recovery', () => {
    it('should use fallback provider when primary fails', async () => {
      const algoliaError = new Error('Algolia service unavailable')
      const registryResult = {
        nodePacks: [{ id: 'registry-1', name: 'Registry Pack' }],
        querySuggestions: []
      }

      const mockAlgoliaProvider = {
        searchPacks: vi
          .fn()
          .mockResolvedValue({ ok: false, cause: algoliaError }),
        clearSearchCache: vi.fn()
      }

      const mockRegistryProvider = {
        searchPacks: vi.fn().mockResolvedValue(succeeded(registryResult)),
        clearSearchCache: vi.fn()
      }

      vi.mocked(useAlgoliaSearchProvider).mockReturnValue(mockAlgoliaProvider)
      vi.mocked(useComfyRegistrySearchProvider).mockReturnValue(
        mockRegistryProvider
      )

      const gateway = useRegistrySearchGateway()

      const outcome = await gateway.searchPacks('test', {
        pageSize: 10,
        pageNumber: 0
      })

      expect(outcome).toEqual(succeeded(registryResult))
      expect(mockAlgoliaProvider.searchPacks).toHaveBeenCalledTimes(1)
      expect(mockRegistryProvider.searchPacks).toHaveBeenCalledTimes(1)
    })
  })
})
