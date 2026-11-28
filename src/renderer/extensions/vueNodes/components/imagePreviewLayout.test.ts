import { describe, expect, it } from 'vitest'

import { fitImageGridHeight, imageGridColumns } from './imagePreviewLayout'

describe('fitImageGridHeight', () => {
  it.for([
    {
      name: 'fits every row exactly when the columns stay put',
      grid: { count: 4, columns: 2, aspectRatio: 1, width: 204, gap: 4 },
      minHeight: 100,
      height: 204,
      columns: 2
    },
    {
      name: 'stops short of the height where the grid would reflow',
      grid: { count: 5, columns: 4, aspectRatio: 1, width: 100, gap: 0 },
      minHeight: 10,
      height: 500 / 3.5 ** 2 - 1,
      columns: 4
    },
    {
      name: 'caps a large batch at twice the width with denser columns',
      grid: { count: 40, columns: 2, aspectRatio: 1, width: 100, gap: 0 },
      minHeight: 50,
      height: 200,
      columns: 4
    },
    {
      name: 'refits for the columns the grid shows at its minimum height',
      grid: { count: 2, columns: 2, aspectRatio: 2, width: 100, gap: 0 },
      minHeight: 80,
      height: 100,
      columns: 1
    }
  ])('$name', ({ grid, minHeight, height, columns }) => {
    const fitted = fitImageGridHeight({ ...grid, minHeight })

    expect(fitted).toBeCloseTo(height, 6)
    expect(imageGridColumns({ ...grid, height: fitted })).toBe(columns)
  })
})
