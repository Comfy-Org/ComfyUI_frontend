import { describe, expect, it } from 'vitest'

import { coverageOpacityClass } from '@/platform/assets/schemas/userPropertySchema'

describe('coverageOpacityClass', () => {
  it('returns font-semibold for full coverage', () => {
    expect(coverageOpacityClass(5, 5)).toBe('font-semibold')
  })

  it('returns font-semibold for 1/1', () => {
    expect(coverageOpacityClass(1, 1)).toBe('font-semibold')
  })

  it('returns opacity-75 for >66% coverage', () => {
    expect(coverageOpacityClass(4, 5)).toBe('opacity-75')
  })

  it('returns opacity-55 for >33% coverage', () => {
    expect(coverageOpacityClass(2, 5)).toBe('opacity-55')
  })

  it('returns opacity-40 for <=33% coverage', () => {
    expect(coverageOpacityClass(1, 5)).toBe('opacity-40')
  })

  it('returns opacity-55 for 1 out of 3 (33.3%, just above 0.33)', () => {
    expect(coverageOpacityClass(1, 3)).toBe('opacity-55')
  })

  it('returns opacity-55 for 2 out of 5 (40%)', () => {
    expect(coverageOpacityClass(2, 5)).toBe('opacity-55')
  })
})
