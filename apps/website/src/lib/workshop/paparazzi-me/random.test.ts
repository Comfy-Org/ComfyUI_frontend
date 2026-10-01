import { describe, expect, it } from 'vitest'

import { dateStamp, hashText, seededRandom, snappers } from './random'

describe('seededRandom', () => {
  it('repeats for a seed and differs between seeds', () => {
    const take = (seed: number) => {
      const random = seededRandom(seed)
      return [random(), random(), random()]
    }
    expect(take(4)).toEqual(take(4))
    expect(take(4)).not.toEqual(take(5))
    expect(take(4).every((value) => value >= 0 && value < 1)).toBe(true)
  })
})

describe('snappers', () => {
  it('spreads the photographers across the bottom of the frame', () => {
    const crowd = snappers(1207)
    expect(crowd).toEqual(snappers(1207))
    expect(crowd).toHaveLength(7)
    const across = crowd.map(({ x }) => x)
    expect(across).toEqual([...across].sort((a, b) => a - b))
    expect(crowd.every(({ y }) => y >= 0.86 && y < 0.94)).toBe(true)
  })
})

describe('dateStamp', () => {
  it.for([
    { seed: 0, stamp: "'26 01 01" },
    { seed: 1207, stamp: "'26 08 17" }
  ])('stamps seed $seed as $stamp', ({ seed, stamp }) => {
    expect(dateStamp(seed)).toBe(stamp)
  })
})

describe('hashText', () => {
  it('gives the same text the same number', () => {
    expect(hashText('rooftop')).toBe(hashText('rooftop'))
    expect(hashText('rooftop')).not.toBe(hashText('rooftops'))
  })
})
