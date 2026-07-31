import { describe, expect, it } from 'vitest'

import { userBadgeColor } from './badgeColor'

const HEX = /^#[0-9a-f]{6}$/

describe('userBadgeColor', () => {
  it('is deterministic for the same seed', () => {
    expect(userBadgeColor('Ada Lovelace')).toBe(userBadgeColor('Ada Lovelace'))
  })

  it('always returns a color from the palette', () => {
    for (const seed of ['', 'a', 'Grace Hopper', 'user@example.com', '你好']) {
      expect(userBadgeColor(seed)).toMatch(HEX)
    }
  })

  it('spreads different seeds across more than one color', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => `user-${i}`)
    const distinct = new Set(seeds.map(userBadgeColor))
    expect(distinct.size).toBeGreaterThan(1)
  })
})
