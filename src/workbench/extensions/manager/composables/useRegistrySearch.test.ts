import { until } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { reportError } from '@/platform/telemetry/reportError'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type {
  SearchMode,
  SearchPacksOutcome,
  SearchPacksResult
} from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/services/gateway/registrySearchGateway'), () => {
  const gateway = {
    searchPacks: vi.fn(),
    clearSearchCache: vi.fn(),
    resetCircuits: vi.fn()
  }
  return { useRegistrySearchGateway: () => gateway }
})

const succeeded = (result: SearchPacksResult): SearchPacksOutcome => ({
  ok: true,
  result
})

const failed = (message: string): SearchPacksOutcome => ({
  ok: false,
  cause: new Error(message)
})

const packs = (count: number): SearchPacksResult['nodePacks'] =>
  Array.from({ length: count }, (_, i) => ({ id: `pack-${i}` }))

async function searchWith(result: SearchPacksResult) {
  vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
    succeeded(result)
  )
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
        status: 'loaded',
        query: 'test',
        rawResultsEmpty: expected
      })
    }
  )

  it('keeps no first page while the next search loads, then reports its query', async () => {
    let resolveNextSearch: (result: SearchPacksResult) => void = () => {}
    const nextSearch = new Promise<SearchPacksOutcome>((resolve) => {
      resolveNextSearch = (result) => resolve(succeeded(result))
    })
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: packs(1),
          querySuggestions: [],
          rawResultsEmpty: true
        })
      )
      .mockReturnValueOnce(nextSearch)
    const query = ref('kijai/comfyui-kjnodes')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      status: 'loaded',
      query: 'kijai/comfyui-kjnodes',
      rawResultsEmpty: true
    })

    query.value = 'comfyui-manager'
    await until(search.isLoading).toBe(true)

    expect(search.firstPage.value).toEqual({ status: 'loading' })

    resolveNextSearch({
      nodePacks: [],
      querySuggestions: [],
      rawResultsEmpty: true
    })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      status: 'loaded',
      query: 'comfyui-manager',
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
            resolveStaleSearch = (result) => resolve(succeeded(result))
          })
        )
        .mockResolvedValueOnce(
          succeeded({
            nodePacks: [{ id: 'current-pack' }],
            querySuggestions: [],
            hasMore: true,
            rawResultsEmpty: false
          })
        )
        .mockResolvedValueOnce(
          succeeded({
            nodePacks: [{ id: 'current-pack-2' }],
            querySuggestions: [],
            hasMore: false,
            rawResultsEmpty: false
          })
        )
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
        status: 'loaded',
        query: changed.query,
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
    let failStaleSearch: (error: Error) => void = () => {}
    vi.mocked(searchPacks)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          failStaleSearch = (cause) => resolve({ ok: false, cause })
        })
      )
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: [{ id: 'current-pack' }],
          querySuggestions: [],
          rawResultsEmpty: false
        })
      )
    const searchMode = ref<SearchMode>('nodes')
    const search = useRegistrySearch({ query: 'comfyui-manager', searchMode })
    await until(search.isLoading).toBe(true)

    searchMode.value = 'packs'
    await nextTick()
    failStaleSearch(new Error('search unavailable'))
    await until(search.isLoading).toBe(false)

    expect(reportError).not.toHaveBeenCalled()
    expect(toValue(search.items)).toEqual([{ id: 'current-pack' }])
    expect(search.firstPage.value).toEqual({
      status: 'loaded',
      query: 'comfyui-manager',
      rawResultsEmpty: false
    })
  })

  it('drops the first page and its packs as soon as the mode changes while a later page loads', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: [{ id: 'nodes-pack' }],
          querySuggestions: [],
          hasMore: true,
          rawResultsEmpty: true
        })
      )
      .mockReturnValueOnce(new Promise(() => {}))
    const searchMode = ref<SearchMode>('nodes')
    const search = useRegistrySearch({ query: 'comfyui-manager', searchMode })
    await until(search.isLoading).toBe(false)
    void search.loadMore()

    searchMode.value = 'packs'
    await nextTick()

    expect(search.firstPage.value).toEqual({ status: 'loading' })
    expect(toValue(search.items)).toEqual([])
  })

  it('drops a later page that lands after the mode changed and loads the first page for the new mode', async () => {
    const { searchPacks } = useRegistrySearchGateway()
    let resolveStalePage: (result: SearchPacksResult) => void = () => {}
    let resolveFirstPage: (result: SearchPacksResult) => void = () => {}
    vi.mocked(searchPacks)
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: [{ id: 'nodes-pack' }],
          querySuggestions: [],
          hasMore: true,
          rawResultsEmpty: false
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStalePage = (result) => resolve(succeeded(result))
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstPage = (result) => resolve(succeeded(result))
        })
      )
    const searchMode = ref<SearchMode>('nodes')
    const search = useRegistrySearch({ query: 'comfyui-manager', searchMode })
    await until(search.isLoading).toBe(false)
    const loadingMore = search.loadMore()

    searchMode.value = 'packs'
    await nextTick()
    resolveStalePage({
      nodePacks: [{ id: 'stale-pack' }],
      querySuggestions: [{ query: 'stale-suggestion', popularity: 1 }],
      hasMore: true,
      rawResultsEmpty: false
    })

    expect(await loadingMore).toBe(false)
    expect(toValue(search.items)).not.toContainEqual({ id: 'stale-pack' })
    expect(search.suggestions.value).toEqual([])

    resolveFirstPage({
      nodePacks: [{ id: 'packs-pack' }],
      querySuggestions: [],
      hasMore: false,
      rawResultsEmpty: false
    })
    await until(search.isLoading).toBe(false)

    expect(toValue(search.items)).toEqual([{ id: 'packs-pack' }])
    expect(toValue(search.hasMore)).toBe(false)
    expect(
      vi
        .mocked(searchPacks)
        .mock.calls.map(([, params]) => [
          params.pageNumber,
          params.restrictSearchableAttributes
        ])
    ).toEqual([
      [0, ['comfy_nodes']],
      [1, ['comfy_nodes']],
      [0, ['name', 'description']]
    ])
  })

  it('searches only the latest query when it changes twice while the first page loads', async () => {
    const { searchPacks } = useRegistrySearchGateway()
    const staleResolvers: ((result: SearchPacksResult) => void)[] = []
    const onePackPage = (id: string): SearchPacksResult => ({
      nodePacks: [{ id }],
      querySuggestions: [],
      rawResultsEmpty: false
    })
    vi.mocked(searchPacks)
      .mockReturnValueOnce(
        new Promise((resolve) =>
          staleResolvers.push((result) => resolve(succeeded(result)))
        )
      )
      .mockReturnValueOnce(
        new Promise((resolve) =>
          staleResolvers.push((result) => resolve(succeeded(result)))
        )
      )
      .mockResolvedValueOnce(succeeded(onePackPage('latest-pack')))
    const query = ref('comfyui-kjnodes')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(true)

    query.value = 'comfyui-manager'
    await nextTick()
    staleResolvers[0](onePackPage('first-stale-pack'))
    await vi.waitFor(() => expect(searchPacks).toHaveBeenCalledTimes(2))
    query.value = 'gguf'
    await nextTick()
    staleResolvers[1](onePackPage('second-stale-pack'))
    await until(search.isLoading).toBe(false)

    expect(toValue(search.items)).toEqual([{ id: 'latest-pack' }])
    expect(search.firstPage.value).toEqual({
      status: 'loaded',
      query: 'gguf',
      rawResultsEmpty: false
    })
    expect(
      vi.mocked(searchPacks).mock.calls.map(([searched]) => searched)
    ).toEqual(['comfyui-kjnodes', 'comfyui-manager', 'gguf'])
  })

  describe('a later page that lands after the query changed and changed back', () => {
    async function searchWhileQueryChangesBack(stalePage: SearchPacksOutcome) {
      const { searchPacks } = useRegistrySearchGateway()
      let settleStalePage: (outcome: SearchPacksOutcome) => void = () => {}
      vi.mocked(searchPacks)
        .mockResolvedValueOnce(
          succeeded({
            nodePacks: [{ id: 'gguf-1' }],
            querySuggestions: [{ query: 'gguf', popularity: 1 }],
            hasMore: true,
            rawResultsEmpty: false
          })
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            settleStalePage = resolve
          })
        )
        .mockReturnValueOnce(new Promise(() => {}))
      const query = ref('gguf')
      const search = useRegistrySearch({ query, searchMode: 'packs' })
      await until(search.isLoading).toBe(false)
      void search.loadMore()

      query.value = 'ggufx'
      await nextTick()
      query.value = 'gguf'
      await nextTick()
      settleStalePage(stalePage)
      await vi.waitFor(() => expect(searchPacks).toHaveBeenCalledTimes(3))
      return search
    }

    it('drops the page instead of showing it while the first page reloads', async () => {
      const search = await searchWhileQueryChangesBack(
        succeeded({
          nodePacks: [{ id: 'stale-gguf-2' }],
          querySuggestions: [{ query: 'stale-suggestion', popularity: 1 }],
          hasMore: true,
          rawResultsEmpty: false
        })
      )

      expect(toValue(search.items)).toEqual([])
      expect(search.firstPage.value).toEqual({ status: 'loading' })
      expect(search.suggestions.value).not.toContainEqual({
        query: 'stale-suggestion',
        popularity: 1
      })
    })

    it('neither reports nor ends pagination when the page fails', async () => {
      const search = await searchWhileQueryChangesBack(
        failed('search unavailable')
      )

      expect(reportError).not.toHaveBeenCalled()
      expect(toValue(search.hasMore)).toBe(true)
    })
  })

  it('reports no failure while the results are off screen', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      failed('search unavailable')
    )
    const search = useRegistrySearch({
      query: '',
      searchMode: 'packs',
      isVisible: false
    })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({ status: 'failed', query: '' })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('resets the gateway circuits and searches again when asked for new results', async () => {
    const { searchPacks, resetCircuits } = useRegistrySearchGateway()
    vi.mocked(searchPacks)
      .mockResolvedValueOnce(failed('search unavailable'))
      .mockResolvedValueOnce(
        succeeded({ nodePacks: packs(1), querySuggestions: [] })
      )
    const search = useRegistrySearch({ query: 'gguf', searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    await search.loadNew()

    expect(resetCircuits).toHaveBeenCalledOnce()
    expect(toValue(search.items)).toEqual(packs(1))
  })

  it('reports no first page when the search for it fails', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: [],
          querySuggestions: [],
          rawResultsEmpty: true
        })
      )
      .mockResolvedValueOnce(failed('search unavailable'))
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      status: 'failed',
      query: 'comfyui-kjnodes'
    })
    expect(reportError).toHaveBeenCalledWith(new Error('search unavailable'), {
      errorType: 'error_searching_registry_packs',
      surface: 'platform',
      level: 'warning',
      tags: { outcome: 'degraded' }
    })
  })

  it('reports only the first of consecutive search failures', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(failed('search unavailable'))
      .mockResolvedValueOnce(failed('search still unavailable'))
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      status: 'failed',
      query: 'comfyui-kjnodes'
    })
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('search unavailable'),
      expect.objectContaining({ errorType: 'error_searching_registry_packs' })
    )
  })

  it('reports a search failure again after a search succeeds', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(failed('search unavailable'))
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: packs(1),
          querySuggestions: [],
          rawResultsEmpty: false
        })
      )
      .mockResolvedValueOnce(failed('search unavailable again'))
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)
    query.value = 'gguf'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(vi.mocked(reportError).mock.calls.map(([error]) => error)).toEqual([
      new Error('search unavailable'),
      new Error('search unavailable again')
    ])
  })

  it('reports a search failure again after a search succeeds for a query that has since changed', async () => {
    let resolveStaleSearch: (result: SearchPacksResult) => void = () => {}
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(failed('search unavailable'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleSearch = (result) => resolve(succeeded(result))
        })
      )
      .mockResolvedValueOnce(failed('search unavailable again'))
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'a'
    await until(search.isLoading).toBe(true)
    query.value = 'ab'
    await nextTick()
    resolveStaleSearch({
      nodePacks: packs(1),
      querySuggestions: [],
      rawResultsEmpty: false
    })
    await until(search.isLoading).toBe(false)

    expect(vi.mocked(reportError).mock.calls.map(([error]) => error)).toEqual([
      new Error('search unavailable'),
      new Error('search unavailable again')
    ])
  })

  it('reports a failed first-page search and clears the earlier suggestions until the next search', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: packs(1),
          querySuggestions: [{ query: 'comfyui-manager', popularity: 1 }],
          rawResultsEmpty: false
        })
      )
      .mockResolvedValueOnce(failed('search unavailable'))
      .mockResolvedValueOnce(
        succeeded({
          nodePacks: packs(1),
          querySuggestions: [],
          rawResultsEmpty: false
        })
      )
    const query = ref('comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })

    query.value = 'comfyui-kjnodes'
    await until(search.isLoading).toBe(true)
    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toEqual({
      status: 'failed',
      query: 'comfyui-kjnodes'
    })
    expect(toValue(search.items)).toEqual([])
    expect(search.suggestions.value).toEqual([])

    query.value = 'gguf'
    await nextTick()

    expect(search.firstPage.value.status).not.toBe('failed')

    await until(search.isLoading).toBe(false)

    expect(search.firstPage.value).toMatchObject({ status: 'loaded' })
    expect(toValue(search.items)).toEqual(packs(1))
  })

  it('searches the trimmed query and ignores edits that only change surrounding whitespace', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      succeeded({
        nodePacks: packs(1),
        querySuggestions: [],
        rawResultsEmpty: false
      })
    )
    const query = ref(' comfyui-manager')
    const search = useRegistrySearch({ query, searchMode: 'packs' })
    await until(search.isLoading).toBe(false)

    query.value = 'comfyui-manager '
    await nextTick()

    expect(toValue(search.isLoading)).toBe(false)
    expect(search.firstPage.value).toMatchObject({ query: 'comfyui-manager' })
    expect(
      vi
        .mocked(useRegistrySearchGateway().searchPacks)
        .mock.calls.map(([searched]) => searched)
    ).toEqual(['comfyui-manager'])
  })

  it('neither searches again nor reports when a search settles for an older query after its scope is disposed', async () => {
    const { searchPacks } = useRegistrySearchGateway()
    let failSearch: (error: Error) => void = () => {}
    vi.mocked(searchPacks).mockReturnValueOnce(
      new Promise((resolve) => {
        failSearch = (cause) => resolve({ ok: false, cause })
      })
    )
    const query = ref('gguf')
    const scope = effectScope()
    const search = scope.run(() =>
      useRegistrySearch({ query, searchMode: 'packs' })
    )!
    await until(search.isLoading).toBe(true)

    scope.stop()
    query.value = 'gguf loader'
    failSearch(new Error('search unavailable'))
    await until(search.isLoading).toBe(false)

    expect(searchPacks).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  describe('a later page that fails', () => {
    const firstPageResult: SearchPacksResult = {
      nodePacks: [{ id: 'gguf-1' }],
      querySuggestions: [],
      hasMore: true,
      rawResultsEmpty: false
    }
    const secondPageResult: SearchPacksResult = {
      nodePacks: [{ id: 'gguf-2' }],
      querySuggestions: [],
      hasMore: false,
      rawResultsEmpty: false
    }

    async function searchUntilSecondPageFails(
      searchMode: MaybeRefOrGetter<SearchMode> = 'packs'
    ) {
      vi.mocked(useRegistrySearchGateway().searchPacks)
        .mockResolvedValueOnce(succeeded(firstPageResult))
        .mockResolvedValueOnce(failed('search unavailable'))
      const search = useRegistrySearch({ query: 'gguf', searchMode })
      await until(search.isLoading).toBe(false)
      expect(await search.loadMore()).toBe(false)
      return search
    }

    const searchedPages = () =>
      vi
        .mocked(useRegistrySearchGateway().searchPacks)
        .mock.calls.map(([query, params]) => [
          query,
          params.pageNumber,
          params.restrictSearchableAttributes
        ])

    it('keeps the loaded packs and pauses pagination until it is retried', async () => {
      const search = await searchUntilSecondPageFails()

      expect(toValue(search.items)).toEqual([{ id: 'gguf-1' }])
      expect(search.firstPage.value).toEqual({
        status: 'loaded',
        query: 'gguf',
        rawResultsEmpty: false
      })
      expect(search.isNextPageFailed.value).toBe(true)
      expect(toValue(search.hasMore)).toBe(false)
    })

    it('does not request the failed page again from a scroll load while paused', async () => {
      const search = await searchUntilSecondPageFails()

      expect(await search.loadMore()).toBe(false)

      expect(searchedPages()).toHaveLength(2)
      expect(search.isNextPageFailed.value).toBe(true)
    })

    it('ignores a retry when no page failed', async () => {
      vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValueOnce(
        succeeded(firstPageResult)
      )
      const search = useRegistrySearch({ query: 'gguf', searchMode: 'packs' })
      await until(search.isLoading).toBe(false)

      expect(await search.retryNextPage()).toBe(false)

      expect(useRegistrySearchGateway().resetCircuits).not.toHaveBeenCalled()
      expect(searchedPages()).toHaveLength(1)
    })

    it('loads the same page for the same search when retried', async () => {
      const search = await searchUntilSecondPageFails()
      vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValueOnce(
        succeeded(secondPageResult)
      )

      expect(await search.retryNextPage()).toBe(true)

      expect(useRegistrySearchGateway().resetCircuits).toHaveBeenCalledOnce()
      expect(toValue(search.items)).toEqual([
        { id: 'gguf-1' },
        { id: 'gguf-2' }
      ])
      expect(search.isNextPageFailed.value).toBe(false)
      expect(searchedPages()).toEqual([
        ['gguf', 0, ['name', 'description']],
        ['gguf', 1, ['name', 'description']],
        ['gguf', 1, ['name', 'description']]
      ])
    })

    it('requests the page once when retried again while the retry loads', async () => {
      const search = await searchUntilSecondPageFails()
      vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValueOnce(
        succeeded(secondPageResult)
      )

      await Promise.all([
        search.retryNextPage(),
        search.retryNextPage(),
        search.loadMore()
      ])

      expect(searchedPages()).toHaveLength(3)
      expect(toValue(search.items)).toEqual([
        { id: 'gguf-1' },
        { id: 'gguf-2' }
      ])
    })

    it('drops a retried page that lands after the mode changed', async () => {
      const searchMode = ref<SearchMode>('packs')
      const search = await searchUntilSecondPageFails(searchMode)
      let resolveRetry: (result: SearchPacksResult) => void = () => {}
      vi.mocked(useRegistrySearchGateway().searchPacks)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRetry = (result) => resolve(succeeded(result))
          })
        )
        .mockResolvedValueOnce(
          succeeded({
            nodePacks: [{ id: 'nodes-pack' }],
            querySuggestions: [],
            hasMore: false,
            rawResultsEmpty: false
          })
        )
      const retrying = search.retryNextPage()

      searchMode.value = 'nodes'
      await nextTick()
      resolveRetry(secondPageResult)

      expect(await retrying).toBe(false)
      await until(search.isLoading).toBe(false)
      expect(toValue(search.items)).toEqual([{ id: 'nodes-pack' }])
      expect(search.isNextPageFailed.value).toBe(false)
    })
  })
})

describe('useRegistrySearch analytics tags', () => {
  const searchedTags = () =>
    vi
      .mocked(useRegistrySearchGateway().searchPacks)
      .mock.calls.map(([, params]) => params.analyticsTags)

  function searchFor(query: string, isTypedQuery: boolean) {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      succeeded({
        nodePacks: packs(DEFAULT_PAGE_SIZE),
        querySuggestions: [],
        hasMore: true
      })
    )
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
