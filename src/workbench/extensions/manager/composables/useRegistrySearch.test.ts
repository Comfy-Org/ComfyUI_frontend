import { until } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'

import { DEFAULT_PAGE_SIZE } from '@/constants/searchConstants'
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { components } from '@/types/comfyRegistryTypes'
import type { SearchPacksResult } from '@/types/searchServiceTypes'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'

type RegistryNodePack = components['schemas']['Node']

vi.mock(import('@/services/gateway/registrySearchGateway'), () => {
  const gateway = {
    searchPacks: vi.fn(),
    clearSearchCache: vi.fn()
  }
  return { useRegistrySearchGateway: () => gateway }
})

const packs = (count: number): RegistryNodePack[] =>
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
})
