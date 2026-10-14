import { describe, expect, it } from 'vitest'
import { estimatedConversionProgress } from './estimatedConversionProgress'

describe('estimated conversion progress', () => {
  it('combines locally observed elapsed time with the current total remaining estimate', () => {
    expect(estimatedConversionProgress(10_000, 30, 20_000)).toBe(25)
    expect(estimatedConversionProgress(10_000, 10, 40_000)).toBe(75)
  })
  it('caps an expired estimate below verified completion', () => {
    expect(estimatedConversionProgress(10_000, 0, 20_000)).toBe(99)
  })
  it.for([undefined, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'omits a percentage for unknown or invalid remaining time %s',
    (remaining) => {
      expect(
        estimatedConversionProgress(10_000, remaining, 20_000)
      ).toBeUndefined()
    }
  )
  it('does not count conversion time before local observation', () => {
    expect(estimatedConversionProgress(undefined, 30, 20_000)).toBeUndefined()
    expect(estimatedConversionProgress(30_000, 30, 20_000)).toBe(0)
  })
})
