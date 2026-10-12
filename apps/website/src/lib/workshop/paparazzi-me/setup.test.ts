import { describe, expect, it } from 'vitest'

import {
  MAX_SEED,
  hasCelebrity,
  matchStars,
  nextSeed,
  outputSize
} from './setup'

describe('matchStars', () => {
  it.for([
    { query: '', names: 6 },
    { query: 'nova', names: 1 },
    { query: '  REYES nova ', names: 1 },
    { query: 'o', names: 5 },
    { query: 'zz', names: 0 }
  ])('finds $names stars for "$query"', ({ query, names }) => {
    expect(matchStars(query)).toHaveLength(names)
  })
})

describe('outputSize', () => {
  it.for([
    { resolution: '1K', width: 1024, height: 683 },
    { resolution: '2K', width: 2048, height: 1365 },
    { resolution: '4K', width: 4096, height: 2731 }
  ] as const)(
    'frames $resolution as $width × $height',
    ({ resolution, width, height }) => {
      expect(outputSize(resolution)).toEqual({ width, height })
    }
  )
})

describe('hasCelebrity', () => {
  it.for([
    { celebrity: 'Nova Reyes', ok: true },
    { celebrity: ' A ', ok: false },
    { celebrity: 'Al', ok: true }
  ])('accepts "$celebrity": $ok', ({ celebrity, ok }) => {
    expect(hasCelebrity(celebrity)).toBe(ok)
  })
})

describe('nextSeed', () => {
  it('walks the same way every time and stays in range', () => {
    const walk = [1, 2, 3].reduce<number[]>(
      (seeds) => [...seeds, nextSeed(seeds.at(-1) ?? 7)],
      []
    )
    expect(walk).toEqual([337_897, 1_278_240_558, 449_829_614])
    expect(walk.every((seed) => seed > 0 && seed < MAX_SEED)).toBe(true)
  })
})
