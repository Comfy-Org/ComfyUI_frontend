import { describe, expect, it } from 'vitest'

import { cssSplitPos, gridStyleForCount } from './outputGridUtil'

describe('cssSplitPos', () => {
  it('returns calc expression for ratio 0.5', () => {
    const result = cssSplitPos(0.5)
    expect(result).toBe('calc(8px + (100% - 24px) * 0.5 + 4px)')
  })

  it('returns calc expression for ratio 0', () => {
    const result = cssSplitPos(0)
    expect(result).toBe('calc(8px + (100% - 24px) * 0 + 4px)')
  })

  it('returns calc expression for ratio 1', () => {
    const result = cssSplitPos(1)
    expect(result).toBe('calc(8px + (100% - 24px) * 1 + 4px)')
  })
})

describe('gridStyleForCount', () => {
  it('returns single column for count 1', () => {
    expect(gridStyleForCount(1, 0.5, 0.5)).toEqual({
      gridTemplate: '"a" 1fr / 1fr'
    })
  })

  it('returns two rows for count 2', () => {
    const result = gridStyleForCount(2, 0.5, 0.5)
    expect(result.gridTemplate).toBe('"a" 0.5fr "b" 0.5fr / 1fr')
  })

  it('returns L-shape for count 3', () => {
    const result = gridStyleForCount(3, 0.5, 0.5)
    expect(result.gridTemplate).toBe('"a c" 0.5fr "b c" 0.5fr / 0.5fr 0.5fr')
  })

  it('returns 2x2 grid for count 4', () => {
    const result = gridStyleForCount(4, 0.5, 0.5)
    expect(result.gridTemplate).toBe('"a b" 0.5fr "c d" 0.5fr / 0.5fr 0.5fr')
  })

  it('respects custom row ratio', () => {
    const result = gridStyleForCount(2, 0.7, 0.5)
    expect(result.gridTemplate).toContain('0.7fr')
    expect(result.gridTemplate).toContain(`${1 - 0.7}fr`)
  })

  it('respects custom column ratio', () => {
    const result = gridStyleForCount(4, 0.5, 0.3)
    expect(result.gridTemplate).toContain('0.3fr')
    expect(result.gridTemplate).toContain(`${1 - 0.3}fr`)
  })

  it('defaults to single for count 0', () => {
    expect(gridStyleForCount(0, 0.5, 0.5)).toEqual({
      gridTemplate: '"a" 1fr / 1fr'
    })
  })
})
