import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGridStyle } from '@/utils/gridUtil'

describe('createGridStyle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates an auto-fill grid with default options', () => {
    expect(createGridStyle()).toEqual({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))',
      padding: '0',
      gap: '1rem'
    })
  })

  it('creates an auto-fill grid with custom options', () => {
    expect(
      createGridStyle({
        minWidth: '12rem',
        maxWidth: '24rem',
        padding: '2rem',
        gap: '0.5rem'
      })
    ).toEqual({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 24rem))',
      padding: '2rem',
      gap: '0.5rem'
    })
  })

  it('uses a fixed column count when provided', () => {
    expect(createGridStyle({ columns: 3 }).gridTemplateColumns).toBe(
      'repeat(3, 1fr)'
    )
  })

  it('warns and clamps negative column counts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(createGridStyle({ columns: -1 }).gridTemplateColumns).toBe(
      'repeat(1, 1fr)'
    )
    expect(warn).toHaveBeenCalledWith(
      'createGridStyle: columns must be >= 1, defaulting to 1'
    )
  })
})
