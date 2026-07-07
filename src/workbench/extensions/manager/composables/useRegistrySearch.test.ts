import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SortableField } from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

const mockSearchGateway = vi.hoisted(() => ({
  searchPacks: vi.fn(),
  clearSearchCache: vi.fn(),
  getSortValue: vi.fn(
    (pack: Record<string, unknown>, field: string) => pack[field]
  ),
  getSortableFields: vi.fn((): SortableField[] => [])
}))

vi.mock('@vueuse/core', async () => {
  const vue = await import('vue')
  return {
    watchDebounced: (
      source: unknown,
      callback: () => void,
      options?: { immediate?: boolean }
    ) => {
      if (options?.immediate) callback()
      return vue.watch(source as Parameters<typeof vue.watch>[0], callback)
    }
  }
})

vi.mock('@/services/gateway/registrySearchGateway', () => ({
  useRegistrySearchGateway: () => mockSearchGateway
}))

function pack(name: string, downloads = 0) {
  return { id: name, name, downloads }
}

async function flushSearch() {
  await nextTick()
  await Promise.resolve()
}

describe('useRegistrySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchGateway.searchPacks.mockResolvedValue({
      nodePacks: [],
      querySuggestions: []
    })
    mockSearchGateway.getSortableFields.mockReturnValue([])
  })

  it('runs the initial pack search with default paging and attributes', async () => {
    mockSearchGateway.searchPacks.mockResolvedValueOnce({
      nodePacks: [pack('alpha')],
      querySuggestions: [{ query: 'alpha' }]
    })

    const search = useRegistrySearch({ initialSearchQuery: 'alp' })
    await flushSearch()

    expect(mockSearchGateway.searchPacks).toHaveBeenCalledWith('alp', {
      pageSize: search.pageSize.value,
      pageNumber: 0,
      restrictSearchableAttributes: ['name', 'description']
    })
    expect(search.searchResults.value).toEqual([pack('alpha')])
    expect(search.suggestions.value).toEqual([{ query: 'alpha' }])
    expect(search.isLoading.value).toBe(false)
  })

  it('uses node-search attributes when search mode is nodes', async () => {
    const search = useRegistrySearch({ initialSearchMode: 'nodes' })
    await flushSearch()

    expect(mockSearchGateway.searchPacks).toHaveBeenCalledWith('', {
      pageSize: search.pageSize.value,
      pageNumber: 0,
      restrictSearchableAttributes: ['comfy_nodes']
    })
  })

  it('sorts manually when a non-default sort field is selected', async () => {
    mockSearchGateway.getSortableFields.mockReturnValue([
      { id: 'name', label: 'Name', direction: 'asc' }
    ])
    mockSearchGateway.searchPacks.mockResolvedValueOnce({
      nodePacks: [pack('zeta'), pack('alpha')],
      querySuggestions: []
    })

    const search = useRegistrySearch({ initialSortField: 'name' })
    await flushSearch()

    expect(search.searchResults.value.map((item) => item.name)).toEqual([
      'alpha',
      'zeta'
    ])
  })

  it('appends results when loading later pages', async () => {
    mockSearchGateway.searchPacks
      .mockResolvedValueOnce({
        nodePacks: [pack('first')],
        querySuggestions: []
      })
      .mockResolvedValueOnce({
        nodePacks: [pack('second')],
        querySuggestions: []
      })

    const search = useRegistrySearch()
    await flushSearch()

    search.pageNumber.value = 1
    await flushSearch()

    expect(search.searchResults.value.map((item) => item.name)).toEqual([
      'first',
      'second'
    ])
    expect(mockSearchGateway.searchPacks).toHaveBeenLastCalledWith('', {
      pageSize: search.pageSize.value,
      pageNumber: 1,
      restrictSearchableAttributes: ['name', 'description']
    })
  })

  it('resets to the first page when sort field changes', async () => {
    mockSearchGateway.searchPacks
      .mockResolvedValueOnce({
        nodePacks: [pack('first')],
        querySuggestions: []
      })
      .mockResolvedValueOnce({
        nodePacks: [pack('second')],
        querySuggestions: []
      })
      .mockResolvedValueOnce({
        nodePacks: [pack('resorted')],
        querySuggestions: []
      })

    const search = useRegistrySearch()
    await flushSearch()

    search.pageNumber.value = 1
    await flushSearch()
    expect(search.pageNumber.value).toBe(1)

    search.sortField.value = 'name'
    await flushSearch()

    expect(search.pageNumber.value).toBe(0)
    expect(search.searchResults.value).toEqual([pack('resorted')])
  })

  it('exposes sort options and clear cache from the gateway', () => {
    const fields: SortableField[] = [
      { id: 'name', label: 'Name', direction: 'asc' }
    ]
    mockSearchGateway.getSortableFields.mockReturnValue(fields)

    const search = useRegistrySearch()
    search.clearCache()

    expect(search.sortOptions.value).toBe(fields)
    expect(mockSearchGateway.clearSearchCache).toHaveBeenCalled()
  })
})
