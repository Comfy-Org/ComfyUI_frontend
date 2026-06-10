import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  compareAssets,
  mergeAssetStreams,
  pickNextStream
} from '@/platform/assets/utils/assetStreamMerge'
import type {
  AssetSortSpec,
  AssetStreamState
} from '@/platform/assets/utils/assetStreamMerge'

function asset(id: string, createdAt: string, name = `${id}.png`): AssetItem {
  return {
    id,
    name,
    tags: ['output'],
    created_at: createdAt
  }
}

function stream(
  tag: string,
  items: AssetItem[],
  hasMore = false
): AssetStreamState {
  return { tag, items, offset: items.length, hasMore }
}

const NEWEST_FIRST: AssetSortSpec = { sort: 'created_at', order: 'desc' }
const OLDEST_FIRST: AssetSortSpec = { sort: 'created_at', order: 'asc' }
const NAME_ASC: AssetSortSpec = { sort: 'name', order: 'asc' }

describe('compareAssets', () => {
  it('orders by created_at descending for newest-first', () => {
    const older = asset('a', '2026-01-01T00:00:00Z')
    const newer = asset('b', '2026-02-01T00:00:00Z')
    expect(compareAssets(newer, older, NEWEST_FIRST)).toBeLessThan(0)
    expect(compareAssets(older, newer, NEWEST_FIRST)).toBeGreaterThan(0)
  })

  it('orders by name ascending for alphabetical sort', () => {
    const apple = asset('a', '2026-01-01T00:00:00Z', 'apple.png')
    const zebra = asset('b', '2026-01-01T00:00:00Z', 'zebra.png')
    expect(compareAssets(apple, zebra, NAME_ASC)).toBeLessThan(0)
  })
})

describe('mergeAssetStreams', () => {
  it('merges exhausted streams fully, sorted by spec', () => {
    const a1 = asset('a1', '2026-03-01T00:00:00Z')
    const a2 = asset('a2', '2026-01-01T00:00:00Z')
    const b1 = asset('b1', '2026-02-01T00:00:00Z')
    const merged = mergeAssetStreams(
      [stream('output', [a1, a2]), stream('temp', [b1])],
      NEWEST_FIRST
    )
    expect(merged.map((a) => a.id)).toEqual(['a1', 'b1', 'a2'])
  })

  it('dedupes assets appearing in multiple streams', () => {
    const shared = asset('x', '2026-01-01T00:00:00Z')
    const merged = mergeAssetStreams(
      [stream('output', [shared]), stream('input', [{ ...shared }])],
      NEWEST_FIRST
    )
    expect(merged).toHaveLength(1)
  })

  it('holds back items beyond the frontier of an unexhausted stream', () => {
    // Stream A loaded down to Feb; stream B (hasMore) only down to March.
    // January item from A must wait: B may still hold newer-than-January
    // items on its next page.
    const a1 = asset('a1', '2026-04-01T00:00:00Z')
    const a2 = asset('a2', '2026-02-01T00:00:00Z')
    const b1 = asset('b1', '2026-03-01T00:00:00Z')
    const merged = mergeAssetStreams(
      [stream('output', [a1, a2], false), stream('temp', [b1], true)],
      NEWEST_FIRST
    )
    expect(merged.map((a) => a.id)).toEqual(['a1', 'b1'])
  })

  it('emits everything when all streams are exhausted', () => {
    const a1 = asset('a1', '2026-04-01T00:00:00Z')
    const a2 = asset('a2', '2026-02-01T00:00:00Z')
    const b1 = asset('b1', '2026-03-01T00:00:00Z')
    const merged = mergeAssetStreams(
      [stream('output', [a1, a2]), stream('temp', [b1])],
      NEWEST_FIRST
    )
    expect(merged).toHaveLength(3)
  })

  it('respects ascending order when holding back', () => {
    const a1 = asset('a1', '2026-01-01T00:00:00Z')
    const a2 = asset('a2', '2026-03-01T00:00:00Z')
    const b1 = asset('b1', '2026-02-01T00:00:00Z')
    const merged = mergeAssetStreams(
      [stream('output', [a1, a2], true), stream('temp', [b1], false)],
      OLDEST_FIRST
    )
    // output stream frontier is March (hasMore), temp is exhausted:
    // everything loaded sorts at or before the frontier.
    expect(merged.map((a) => a.id)).toEqual(['a1', 'b1', 'a2'])
  })
})

describe('pickNextStream', () => {
  it('returns -1 when all streams are exhausted', () => {
    expect(
      pickNextStream(
        [stream('output', [asset('a', '2026-01-01T00:00:00Z')])],
        NEWEST_FIRST
      )
    ).toBe(-1)
  })

  it('prefers an unexhausted stream with nothing loaded', () => {
    const streams = [
      stream('output', [asset('a', '2026-01-01T00:00:00Z')], true),
      stream('temp', [], true)
    ]
    expect(pickNextStream(streams, NEWEST_FIRST)).toBe(1)
  })

  it('advances the stream whose frontier is least far along', () => {
    const streams = [
      // frontier March — further along under newest-first
      stream('output', [asset('a', '2026-03-01T00:00:00Z')], true),
      // frontier April — still near the top
      stream('temp', [asset('b', '2026-04-01T00:00:00Z')], true)
    ]
    expect(pickNextStream(streams, NEWEST_FIRST)).toBe(1)
  })

  it('skips exhausted streams', () => {
    const streams = [
      stream('output', [asset('a', '2026-03-01T00:00:00Z')], false),
      stream('temp', [asset('b', '2026-04-01T00:00:00Z')], true)
    ]
    expect(pickNextStream(streams, NEWEST_FIRST)).toBe(1)
  })
})
