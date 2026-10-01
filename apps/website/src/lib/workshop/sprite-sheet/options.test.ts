import { describe, expect, it } from 'vitest'

import { nextFrameRate, sheetGrid } from './options'

describe('sheetGrid', () => {
  it.for([
    { frames: 1, columns: 1, rows: 1 },
    { frames: 4, columns: 4, rows: 1 },
    { frames: 8, columns: 4, rows: 2 },
    { frames: 12, columns: 4, rows: 3 }
  ])(
    'lays $frames frames out $columns by $rows',
    ({ frames, columns, rows }) => {
      expect(sheetGrid(frames)).toEqual({ columns, rows })
    }
  )
})

describe('nextFrameRate', () => {
  it('steps up through the rates and wraps round', () => {
    expect([nextFrameRate(6), nextFrameRate(8), nextFrameRate(12)]).toEqual([
      8, 12, 6
    ])
  })
})
