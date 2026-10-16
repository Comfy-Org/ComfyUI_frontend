import { until } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, toValue } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { SearchPacksResult } from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

vi.mock(import('@/services/gateway/registrySearchGateway'), () => {
  const gateway = {
    searchPacks: vi.fn(),
    clearSearchCache: vi.fn()
  }
  return { useRegistrySearchGateway: () => gateway }
})

const packs = (count: number): SearchPacksResult['nodePacks'] =>
  Array.from({ length: count }, (_, i) => ({ id: `pack-${i}` }))

async function searchWith(result: SearchPacksResult) {
  vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(result)
  const search = useRegistrySearch({ query: 'test', searchMode: 'packs' })
  await until(search.isLoading).toBe(false)
  return search
}

describe('useRegistrySearch', () => {
  it.for([
    { hasMore: true, count: 3, expected: true },
    { hasMore: false, count: DEFAULT_PAGE_SIZE, expected: false },
    { hasMore: undefined, count: DEFAULT_PAGE_SIZE, expected: true },
    { hasMore: undefined, count: 3, expected: false }
  ])(
    'reports hasMore $expected when the provider says $hasMore for $count packs',
    async ({ hasMore, count, expected }) => {
      const search = await searchWith({
        nodePacks: packs(count),
        querySuggestions: [],
        hasMore
      })

      expect(toValue(search.hasMore)).toBe(expected)
    }
  )

  it.for([
    { rawResultsEmpty: true, count: 3, expected: true },
    { rawResultsEmpty: false, count: 3, expected: false },
    { rawResultsEmpty: undefined, count: 0, expected: true },
    { rawResultsEmpty: undefined, count: 3, expected: false }
  ])(
    'reports rawResultsEmpty $expected when the provider says $rawResultsEmpty for $count packs',
    async ({ rawResultsEmpty, count, expected }) => {
      const search = await searchWith({
        nodePacks: packs(count),
        querySuggestions: [],
        rawResultsEmpty
      })

      expect(search.firstPage.value).toEqual({
        query: 'test',
        rawResultsEmpty: expected
      })
    }
  )

  it('keeps no first page while the next search loads, then reports its query', async () => {
    let resolveNextSearch: (result: SearchPacksResult) => void = () => {}
    const nextSearch = new Promise<SearchPacksResult>((resolve) => {
      resolveNextSearch = resolve
    })
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce({
        nodePacks: packs(1),
        querySuggestions: [],
        rawResultsEmpty: true
      })
      .mockReturnValueOnce(nextSearch)
    const query = ref('kijai/comfyui-kjnodes')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      query: 'kijai/comfyui-kjnodes',
      rawResultsEmpty: true
    })

    query.value = 'comfyui-manager'
    await until(search.isLoading).toBe(true)

    expect(search.firstPage.value).toBeNull()

    resolveNextSearch({
      nodePacks: [],
      querySuggestions: [],
      rawResultsEmpty: true
    })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      query: 'comfyui-manager',
      rawResultsEmpty: true
    })
  })

  it('reports no first page when the search for it fails', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce({
        nodePacks: [],
        querySuggestions: [],
        rawResultsEmpty: true
      })
      .mockRejectedValueOnce(new Error('search unavailable'))
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toBeNull()
    expect(console.error).toHaveBeenCalledWith(new Error('search unavailable'))
  })

  it('searches the trimmed query and ignores edits that only change surrounding whitespace', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue({
      nodePacks: packs(1),
      querySuggestions: [],
      rawResultsEmpty: false
    })
    const query = ref(' comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-manager '
    await nextTick()

    expect(toValue(search.isLoading)).toBe(false)
    expect(search.firstPage.value?.query).toBe('comfyui-manager')
    expect(
      vi
        .mocked(useRegistrySearchGateway().searchPacks)
        .mock.calls.map(([searched]) => searched)
    ).toEqual(['comfyui-manager'])
  })

  it('keeps the first page when a later page fails', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce({
        nodePacks: packs(DEFAULT_PAGE_SIZE),
        querySuggestions: [],
        hasMore: true,
        rawResultsEmpty: false
      })
      .mockRejectedValueOnce(new Error('search unavailable'))
    const search = useRegistrySearch({ query: 'gguf', searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    await search.loadMore()

    expect(search.firstPage.value).toEqual({
      query: 'gguf',
      rawResultsEmpty: false
    })
  })
})

describe('useRegistrySearch analytics tags', () => {
  const searchedTags = () =>
    vi
      .mocked(useRegistrySearchGateway().searchPacks)
      .mock.calls.map(([, params]) => params.analyticsTags)

  function searchFor(query: string, isTypedQuery: boolean) {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue({
      nodePacks: packs(DEFAULT_PAGE_SIZE),
      querySuggestions: [],
      hasMore: true
    })
    return useRegistrySearch({ query, searchMode: 'packs', isTypedQuery })
  }

  it('tags the first page of a typed query as user', async () => {
    const search = searchFor('gguf', true)
    await until(search.isLoading).toBe(false)

    expect(searchedTags()).toEqual([['user']])
  })

  it.for([
    { query: '', isTypedQuery: true, case: 'the empty listing' },
    { query: 'comfyui-kjnodes', isTypedQuery: false, case: 'a deep link' }
  ])('leaves $case untagged', async ({ query, isTypedQuery }) => {
    const search = searchFor(query, isTypedQuery)
    await until(search.isLoading).toBe(false)

    expect(searchedTags()).toEqual([undefined])
  })

  it('leaves later pages of a typed query untagged', async () => {
    const search = searchFor('gguf', true)
    await until(search.isLoading).toBe(false)

    await search.loadMore()

    expect(searchedTags()).toEqual([['user'], undefined])
  })
})
