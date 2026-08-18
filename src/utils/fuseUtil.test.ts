import { describe, expect, it, vi } from 'vitest'

import type { FuseSearchable } from '@/utils/fuseUtil'
import { FuseFilter, FuseSearch } from '@/utils/fuseUtil'

interface SearchItem extends Partial<FuseSearchable> {
  name: string
}

interface FilterItem {
  options: string[]
}

const makeSearch = <T>(data: T[] = []) =>
  new FuseSearch<T>(data, {
    fuseOptions: {
      keys: ['name'],
      includeScore: true,
      threshold: 0.6,
      shouldSort: false
    },
    advancedScoring: true
  })

describe('FuseSearch', () => {
  it('assigns stable ranking tiers for exact, prefix, word, substring, and multi-part matches', () => {
    const search = new FuseSearch<string>([], {})

    const cases = [
      { query: 'load image', item: 'load image', tier: 0 },
      { query: 'load', item: 'Load Image', tier: 1 },
      { query: 'image', item: 'LoadImage', tier: 2 },
      { query: 'cast', item: 'broadcast', tier: 3 },
      { query: 'batch latent', item: 'LatentBatch', tier: 4 },
      { query: 'ten bat', item: 'LatentBatch', tier: 5 },
      { query: 'vae', item: 'KSampler', tier: 9 }
    ]

    for (const { query, item, tier } of cases) {
      expect(search.calcAuxSingle(query, item, 0)[0]).toBe(tier)
    }
  })

  it('penalizes deprecated non-exact matches without penalizing exact matches', () => {
    const search = makeSearch<SearchItem>()

    expect(
      search.calcAuxScores('image', { name: 'Image Deprecated' }, 0)[0]
    ).toBe(6)
    expect(
      search.calcAuxScores('deprecated node', { name: 'Deprecated Node' }, 0)[0]
    ).toBe(0)
  })

  it('lets searchable entries post-process their auxiliary scores', () => {
    const search = makeSearch<SearchItem>()
    const entry: SearchItem = {
      name: 'Image Loader',
      postProcessSearchScores: (scores) => [scores[0] + 2, ...scores.slice(1)]
    }

    expect(search.calcAuxScores('image', entry, 0)[0]).toBe(3)
  })

  it('sorts advanced search results by auxiliary ranking instead of Fuse order', () => {
    const exact = { name: 'Image' }
    const prefix = { name: 'Image Loader' }
    const camelCaseWord = { name: 'LoadImage' }
    const substring = { name: 'PreimageNode' }
    const deprecated = { name: 'Image Deprecated' }
    const search = makeSearch([
      substring,
      deprecated,
      camelCaseWord,
      prefix,
      exact
    ])

    expect(search.search('image')).toEqual([
      exact,
      prefix,
      camelCaseWord,
      substring,
      deprecated
    ])
  })

  it('returns data in original order for an empty query without calling Fuse', () => {
    const data = [{ name: 'B' }, { name: 'A' }]
    const search = makeSearch(data)
    const fuseSearchSpy = vi.spyOn(search.fuse, 'search')

    expect(search.search('')).toEqual(data)
    expect(fuseSearchSpy).not.toHaveBeenCalled()
  })

  it('compares auxiliary scores by the first differing value and then length', () => {
    const search = new FuseSearch<string>([], {})

    expect(
      [
        [1, 4],
        [1, 2],
        [0, 99]
      ].sort(search.compareAux)
    ).toEqual([
      [0, 99],
      [1, 2],
      [1, 4]
    ])

    expect(
      [
        [1, 2, 0],
        [1, 2]
      ].sort(search.compareAux)
    ).toEqual([
      [1, 2],
      [1, 2, 0]
    ])
  })
})

describe('FuseFilter', () => {
  it('matches single values, comma-separated values, and wildcard fallbacks', () => {
    const imageItem = { options: ['IMAGE', 'LATENT'] }
    const modelItem = { options: ['MODEL'] }
    const filter = new FuseFilter<FilterItem, string>([imageItem, modelItem], {
      id: 'type',
      name: 'Type',
      invokeSequence: 't',
      getItemOptions: (item) => item.options
    })

    expect(filter.getAllNodeOptions([imageItem, modelItem, imageItem])).toEqual(
      ['IMAGE', 'LATENT', 'MODEL']
    )
    expect(filter.matches(imageItem, 'IMAGE')).toBe(true)
    expect(filter.matches(imageItem, 'MODEL')).toBe(false)
    expect(filter.matches(imageItem, 'MODEL,IMAGE')).toBe(true)
    expect(filter.matches(modelItem, '*', { wildcard: '*' })).toBe(true)
    expect(filter.matches(imageItem, 'MODEL', { wildcard: 'IMAGE' })).toBe(true)
    expect(filter.matches(modelItem, 'MODEL', { wildcard: 'IMAGE' })).toBe(
      false
    )
  })
})
