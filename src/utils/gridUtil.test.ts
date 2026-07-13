import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGridStyle } from '@/utils/gridUtil'

describe('createGridStyle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses auto-fill columns by default', () => {
    expect(createGridStyle()).toEqual({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))',
      padding: '0',
      gap: '1rem'
    })
  })

  it('uses fixed columns when provided', () => {
    expect(
      createGridStyle({
        columns: 3,
        padding: '8px',
        gap: '4px'
      })
    ).toEqual({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      padding: '8px',
      gap: '4px'
    })
  })

  it('warns and clamps invalid fixed columns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(createGridStyle({ columns: -1 }).gridTemplateColumns).toBe(
      'repeat(1, 1fr)'
    )
    expect(warn).toHaveBeenCalledWith(
      'createGridStyle: columns must be >= 1, defaulting to 1'
    )
  })
})
