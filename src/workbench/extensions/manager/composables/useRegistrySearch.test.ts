import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { NodePackSearchProvider } from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

vi.mock('@/services/gateway/registrySearchGateway')

function mockGateway(searchPacks: NodePackSearchProvider['searchPacks']) {
  vi.mocked(useRegistrySearchGateway).mockReturnValue({
    searchPacks,
    clearSearchCache: vi.fn(),
    getSortValue: vi.fn(),
    getSortableFields: vi.fn().mockReturnValue([])
  })
}

describe('useRegistrySearch', () => {
  beforeEach(() => {
    // Suppress the immediate debounced search so each test drives the search
    // explicitly via retry(); pending timers stay queued and never fire.
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears loading and records the error when the search fails', async () => {
    const searchPacks = vi
      .fn()
      .mockRejectedValue(new Error('All search providers failed'))
    mockGateway(searchPacks)

    const { isLoading, error, retry } = useRegistrySearch()
    await retry()

    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('All search providers failed')
  })

  it('recovers and clears the error on a successful retry', async () => {
    const searchPacks = vi.fn().mockRejectedValue(new Error('offline'))
    mockGateway(searchPacks)

    const { error, searchResults, retry } = useRegistrySearch()
    await retry()
    expect(error.value).toBe('offline')

    searchPacks.mockResolvedValue({
      nodePacks: [{ id: 'a', name: 'Pack A' }],
      querySuggestions: []
    })
    await retry()

    expect(error.value).toBeNull()
    expect(searchResults.value).toHaveLength(1)
  })
})
