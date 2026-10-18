import { until } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, toValue } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { SearchMode, SearchPacksResult } from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

vi.mock(import('@/platform/telemetry/reportError'))

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
        searchMode: 'packs',
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
      searchMode: 'packs',
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
      searchMode: 'packs',
      rawResultsEmpty: true
    })
  })

  it.for([
    {
      change: 'mode',
      initial: { query: 'comfyui-manager', searchMode: 'nodes' as const },
      initialAttributes: ['comfy_nodes'],
      changed: { query: 'comfyui-manager', searchMode: 'packs' as const }
    },
    {
      change: 'query',
      initial: { query: 'comfyui-kjnodes', searchMode: 'packs' as const },
      initialAttributes: ['name', 'description'],
      changed: { query: 'comfyui-manager', searchMode: 'packs' as const }
    }
  ])(
    'reruns the first-page search when the $change changes while it loads',
    async ({ initial, initialAttributes, changed }) => {
      const { searchPacks } = useRegistrySearchGateway()
      let resolveStaleSearch: (result: SearchPacksResult) => void = () => {}
      vi.mocked(searchPacks)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveStaleSearch = resolve
          })
        )
        .mockResolvedValueOnce({
          nodePacks: [{ id: 'current-pack' }],
          querySuggestions: [],
          hasMore: true,
          rawResultsEmpty: false
        })
        .mockResolvedValueOnce({
          nodePacks: [{ id: 'current-pack-2' }],
          querySuggestions: [],
          hasMore: false,
          rawResultsEmpty: false
        })
      const query = ref(initial.query)
      const searchMode = ref<SearchMode>(initial.searchMode)
      const search = useRegistrySearch({ query, searchMode })
      await until(search.isLoading).toBe(true)

      query.value = changed.query
      searchMode.value = changed.searchMode
      await nextTick()
      resolveStaleSearch({
        nodePacks: [{ id: 'stale-pack' }],
        querySuggestions: [],
        hasMore: true,
        rawResultsEmpty: true
      })
      await until(search.isLoading).toBe(false)

      expect(toValue(search.items)).toEqual([{ id: 'current-pack' }])
      expect(search.firstPage.value).toEqual({
        ...changed,
        rawResultsEmpty: false
      })

      await search.loadMore()

      expect(toValue(search.items)).toEqual([
        { id: 'current-pack' },
        { id: 'current-pack-2' }
      ])
      expect(
        vi
          .mocked(searchPacks)
          .mock.calls.map(([searched, params]) => [
            searched,
            params.pageNumber,
            params.restrictSearchableAttributes
          ])
      ).toEqual([
        [initial.query, 0, initialAttributes],
        [changed.query, 0, ['name', 'description']],
        [changed.query, 1, ['name', 'description']]
      ])
    }
  )

  it('reruns without reporting an error when a search fails after the mode changed', async () => {
    const { searchPacks } = useRegistrySearchGateway()
    let rejectStaleSearch: (error: Error) => void = () => {}
    vi.mocked(searchPacks)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectStaleSearch = reject
        })
      )
      .mockResolvedValueOnce({
        nodePacks: [{ id: 'current-pack' }],
        querySuggestions: [],
        rawResultsEmpty: false
      })
    const searchMode = ref<SearchMode>('nodes')
    const search = useRegistrySearch({ query: 'comfyui-manager', searchMode })
    await until(search.isLoading).toBe(true)

    searchMode.value = 'packs'
    await nextTick()
    rejectStaleSearch(new Error('search unavailable'))
    await until(search.isLoading).toBe(false)

    expect(reportError).not.toHaveBeenCalled()
    expect(toValue(search.items)).toEqual([{ id: 'current-pack' }])
    expect(search.firstPage.value?.searchMode).toBe('packs')
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
    expect(reportError).toHaveBeenCalledWith(new Error('search unavailable'), {
      errorType: 'error_searching_registry_packs',
      surface: 'platform',
      level: 'warning',
      tags: { outcome: 'degraded' }
    })
  })

  it('reports a failed first-page search and clears the earlier suggestions until the next search', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce({
        nodePacks: packs(1),
        querySuggestions: [{ query: 'comfyui-manager', popularity: 1 }],
        rawResultsEmpty: false
      })
      .mockRejectedValueOnce(new Error('search unavailable'))
      .mockResolvedValueOnce({
        nodePacks: packs(1),
        querySuggestions: [],
        rawResultsEmpty: false
      })
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    expect(search.searchFailed.value).toBe(false)

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(search.searchFailed.value).toBe(true)
    expect(toValue(search.items)).toEqual([])
    expect(search.suggestions.value).toEqual([])

    query.value = 'gguf'
    await nextTick()

    expect(search.searchFailed.value).toBe(false)

    await until(search.isLoading).toBe(false)

    expect(search.searchFailed.value).toBe(false)
    expect(toValue(search.items)).toEqual(packs(1))
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

    expect(search.searchFailed.value).toBe(false)
    expect(search.firstPage.value).toEqual({
      query: 'gguf',
      searchMode: 'packs',
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
