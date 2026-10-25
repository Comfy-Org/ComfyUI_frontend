import { describe, expect, it } from 'vitest'

import { selectModelShard } from './router-model-shard'

describe('paid model shard selection', () => {
  it('runs every selected page exactly once across shards', () => {
    const pages = ['image-a', 'image-b', 'video-a', 'audio-a', 'edit-a']
    const shards = [0, 1, 2].flatMap((index) =>
      selectModelShard(pages, index, 3, 2)
    )
    expect(shards.toSorted()).toEqual(pages.toSorted())
  })

  it.for([
    { index: -1, total: 2, max: 2 },
    { index: 2, total: 2, max: 2 },
    { index: 0, total: 0, max: 2 },
    { index: 0.5, total: 2, max: 2 },
    { index: 0, total: 1, max: 1 },
    { index: 2, total: 3, max: 2 }
  ])(
    'rejects an invalid or over-budget shard: $index/$total, max $max',
    ({ index, total, max }) => {
      expect(() => selectModelShard(['a', 'b'], index, total, max)).toThrow()
    }
  )
})
