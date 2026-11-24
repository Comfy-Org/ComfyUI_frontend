import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { MediaAssetDateFilter, MediaAssetSortOption } from './media'
import {
  filterMediaAssets,
  getAssetTime,
  getDateThreshold,
  sortMediaAssets
} from './media'
import type { AssetItem } from './schema'

describe('media filtering and sorting', () => {
  it.for([
    { option: 'newest', expected: ['a', 'b', 'c'] },
    { option: 'oldest', expected: ['c', 'b', 'a'] },
    { option: 'fastest', expected: ['b', 'a', 'c'] },
    { option: 'longest', expected: ['c', 'a', 'b'] },
    { option: 'az', expected: ['b', 'c', 'a'] },
    { option: 'za', expected: ['a', 'c', 'b'] }
  ] satisfies { option: MediaAssetSortOption; expected: string[] }[])(
    'sorts $option without mutating the input',
    ({ option, expected }) => {
      const assets: AssetItem[] = [
        fromPartial({
          id: 'a',
          name: 'file_10.png',
          user_metadata: { create_time: 300, executionTimeInSeconds: 5 }
        }),
        fromPartial({
          id: 'b',
          name: 'z.png',
          display_name: 'file_1.png',
          user_metadata: { create_time: 200, executionTimeInSeconds: 3 }
        }),
        fromPartial({
          id: 'c',
          name: 'file_2.png',
          user_metadata: { create_time: 100, executionTimeInSeconds: 10 }
        })
      ]

      expect(sortMediaAssets(assets, option).map((asset) => asset.id)).toEqual(
        expected
      )
      expect(assets.map((asset) => asset.id)).toEqual(['a', 'b', 'c'])
    }
  )

  it.for([
    { filter: '', expected: null },
    { filter: 'today', expected: new Date(2026, 6, 27).getTime() },
    { filter: 'week', expected: new Date(2026, 6, 20, 12).getTime() },
    { filter: 'month', expected: new Date(2026, 5, 27, 12).getTime() },
    { filter: 'year', expected: new Date(2026, 0, 1).getTime() }
  ] satisfies { filter: MediaAssetDateFilter; expected: number | null }[])(
    'uses the supplied clock for the $filter date threshold',
    ({ filter, expected }) => {
      expect(
        getDateThreshold(filter, new Date(2026, 6, 27, 12).getTime())
      ).toBe(expected)
    }
  )

  it('uses created_at when imported assets have no create_time', () => {
    const asset = fromPartial<AssetItem>({
      created_at: '2026-07-27T12:00:00Z',
      user_metadata: {}
    })

    expect(getAssetTime(asset)).toBe(Date.UTC(2026, 6, 27, 12))
  })

  it('combines media kinds with an inclusive date boundary before sorting', () => {
    const now = new Date(2026, 6, 27, 12).getTime()
    const boundary = new Date(2026, 6, 20, 12).getTime()
    const assets: AssetItem[] = [
      fromPartial({
        id: 'old',
        name: 'old.glb',
        user_metadata: { create_time: boundary - 1 }
      }),
      fromPartial({
        id: 'boundary',
        name: 'boundary.glb',
        user_metadata: { create_time: boundary }
      }),
      fromPartial({
        id: 'recent',
        name: 'recent.glb',
        user_metadata: { create_time: now }
      }),
      fromPartial({
        id: 'video',
        name: 'clip.mp4',
        user_metadata: { create_time: now }
      })
    ]

    const filtered = filterMediaAssets(assets, ['3d'], 'week', now)

    expect(
      sortMediaAssets(filtered, 'newest').map((asset) => asset.id)
    ).toEqual(['recent', 'boundary'])
  })
})
