import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { Pack, PackNode } from '../data/cloudNodes'

import { useFilteredPacks } from './useFilteredPacks'
import type { PackSortMode } from './useFilteredPacks'

function pack(overrides: Partial<Pack> = {}): Pack {
  return {
    id: overrides.id ?? 'pack',
    displayName: overrides.displayName ?? 'Pack',
    nodes: overrides.nodes ?? [],
    downloads: overrides.downloads,
    lastUpdated: overrides.lastUpdated,
    ...overrides
  }
}

function node(name: string, displayName: string): PackNode {
  return { name, displayName, category: 'x' }
}

describe('useFilteredPacks', () => {
  const packs: readonly Pack[] = [
    pack({
      id: 'a',
      displayName: 'Alpha',
      downloads: 100,
      lastUpdated: '2025-01-01T00:00:00Z',
      nodes: [node('aa', 'Aardvark')]
    }),
    pack({
      id: 'b',
      displayName: 'Beta',
      downloads: 300,
      lastUpdated: '2025-06-01T00:00:00Z',
      nodes: [node('bb', 'Beaver'), node('bb2', 'Bumblebee')]
    }),
    pack({
      id: 'c',
      displayName: 'Gamma',
      downloads: 200,
      lastUpdated: '2025-03-01T00:00:00Z',
      nodes: [
        node('cc', 'Cat'),
        node('cc2', 'Crocodile'),
        node('cc3', 'Capybara')
      ]
    })
  ]

  it('sorts by downloads desc by default', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: '',
      sortMode: 'downloads' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts most-nodes places highest count first', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: '',
      sortMode: 'mostNodes' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts A → Z by display name', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: '',
      sortMode: 'az' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.displayName)).toEqual([
      'Alpha',
      'Beta',
      'Gamma'
    ])
  })

  it('sorts recently updated newest first', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: '',
      sortMode: 'recentlyUpdated' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('treats invalid lastUpdated as 0', () => {
    const broken = [
      pack({ id: 'x', lastUpdated: 'nonsense' }),
      pack({ id: 'y', lastUpdated: '2025-01-01T00:00:00Z' })
    ]
    const { filteredPacks } = useFilteredPacks({
      packs: broken,
      query: '',
      sortMode: 'recentlyUpdated' as PackSortMode
    })
    expect(filteredPacks.value[0].id).toBe('y')
  })

  it('matches the search query against pack display names', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: 'beta',
      sortMode: 'az' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.id)).toEqual(['b'])
  })

  it('matches the search query against node display names', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: 'CAPYBARA',
      sortMode: 'az' as PackSortMode
    })
    expect(filteredPacks.value.map((p) => p.id)).toEqual(['c'])
  })

  it('returns empty when nothing matches', () => {
    const { filteredPacks } = useFilteredPacks({
      packs,
      query: 'zzz-no-such-thing',
      sortMode: 'az' as PackSortMode
    })
    expect(filteredPacks.value).toHaveLength(0)
  })

  it('reacts when the query ref changes', () => {
    const query = ref('beta')
    const { filteredPacks } = useFilteredPacks({
      packs,
      query,
      sortMode: 'az' as PackSortMode
    })
    expect(filteredPacks.value).toHaveLength(1)
    query.value = ''
    expect(filteredPacks.value).toHaveLength(3)
  })
})
