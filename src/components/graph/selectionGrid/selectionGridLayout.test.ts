import { describe, expect, it } from 'vitest'

import {
  MAX_TIDY_GAP,
  computeGapBars,
  computeGapLayout,
  computeTidyLayout,
  detectSelectionGrid,
  tidiedGapOf,
  tidyGapOf
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  GapAxis,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const box = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): LayoutBox => ({ id: toNodeId(id), x, y, width, height })

const moved = (boxes: LayoutBox[], positions: BoxPosition[]): LayoutBox[] =>
  boxes.map((b) => {
    const position = positions.find((p) => p.id === b.id)
    return position ? { ...b, x: position.x, y: position.y } : b
  })

const byId = (boxes: LayoutBox[], id: string): LayoutBox => {
  const found = boxes.find((b) => b.id === toNodeId(id))
  if (!found) throw new Error(`missing box ${id}`)
  return found
}

const gapBetween = (
  boxes: LayoutBox[],
  before: string,
  after: string,
  axis: 'x' | 'y'
): number => {
  const a = byId(boxes, before)
  const b = byId(boxes, after)
  return axis === 'x' ? b.x - (a.x + a.width) : b.y - (a.y + a.height)
}

const overlapping = (boxes: LayoutBox[]): boolean =>
  boxes.some((a, i) =>
    boxes
      .slice(i + 1)
      .some(
        (b) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height
      )
  )

const messyGrid = [
  box('a', 0, 0, 200, 100),
  box('b', 280, 8, 120, 140),
  box('c', 4, 170, 240, 80),
  box('d', 300, 185, 100, 60)
]

const alignedGrid = [
  box('a', 0, 0, 200, 100),
  box('b', 260, 0, 120, 160),
  box('c', 0, 200, 240, 80),
  box('d', 260, 200, 100, 60)
]

describe('detectSelectionGrid', () => {
  it.for<{
    name: string
    boxes: LayoutBox[]
    canAdjustGaps: boolean
    rows: number
    columns: number
  }>([
    {
      name: 'a row of mixed heights with nearby tops',
      boxes: [
        box('a', 0, 0, 200, 300),
        box('b', 240, 30, 150, 100),
        box('c', 420, 10, 180, 220)
      ],
      canAdjustGaps: true,
      rows: 1,
      columns: 3
    },
    {
      name: 'a short node centred beside a tall one',
      boxes: [box('a', 0, 0, 200, 600), box('b', 240, 250, 150, 100)],
      canAdjustGaps: true,
      rows: 1,
      columns: 2
    },
    {
      name: 'two level short nodes beside a tall one',
      boxes: [
        box('a', 0, 0, 200, 600),
        box('b', 240, 250, 150, 100),
        box('c', 420, 260, 150, 100)
      ],
      canAdjustGaps: true,
      rows: 1,
      columns: 3
    },
    {
      name: 'a short node below a tall one, beside a node level with both',
      boxes: [
        box('x', 0, 0, 200, 200),
        box('y', 0, 220, 200, 30),
        box('m', 300, 120, 200, 150)
      ],
      canAdjustGaps: false,
      rows: 2,
      columns: 2
    },
    {
      name: 'a short node below another, beside a node level with the first',
      boxes: [
        box('t', 0, 0, 200, 100),
        box('a', 300, 50, 200, 98),
        box('d', 0, 110, 200, 40)
      ],
      canAdjustGaps: false,
      rows: 2,
      columns: 2
    },
    {
      name: 'a tall node that overlaps a tall and a short node level with it',
      boxes: [
        box('sampler', 0, 0, 300, 262),
        box('decode', 340, 0, 200, 46),
        box('save', 580, 30, 300, 270)
      ],
      canAdjustGaps: true,
      rows: 1,
      columns: 3
    },
    {
      name: 'a tall node that overlaps only the taller of two level nodes',
      boxes: [
        box('sampler', 0, 0, 300, 262),
        box('decode', 340, 0, 200, 46),
        box('save', 580, 60, 300, 270)
      ],
      canAdjustGaps: true,
      rows: 1,
      columns: 3
    },
    {
      name: 'a tall node that overlaps a short one by a pixel at the side',
      boxes: [
        box('sampler', 0, 0, 300, 262),
        box('decode', 340, 0, 200, 46),
        box('save', 539, 60, 300, 270)
      ],
      canAdjustGaps: true,
      rows: 1,
      columns: 3
    },
    {
      name: 'two nodes stacked beside a tall one',
      boxes: [
        box('tall', 0, 0, 200, 600),
        box('upper', 240, 0, 150, 100),
        box('lower', 240, 95, 150, 100)
      ],
      canAdjustGaps: false,
      rows: 2,
      columns: 2
    },
    {
      name: 'a column of mixed widths',
      boxes: [
        box('a', 0, 0, 300, 100),
        box('b', 20, 130, 150, 80),
        box('c', 5, 260, 220, 120)
      ],
      canAdjustGaps: true,
      rows: 3,
      columns: 1
    },
    {
      name: 'an aligned 2x2 grid of mixed sizes',
      boxes: alignedGrid,
      canAdjustGaps: true,
      rows: 2,
      columns: 2
    },
    {
      name: 'a grid with an empty cell',
      boxes: [
        box('a', 0, 0, 200, 100),
        box('b', 240, 0, 200, 100),
        box('c', 0, 140, 200, 100)
      ],
      canAdjustGaps: true,
      rows: 2,
      columns: 2
    },
    {
      name: 'a grid within the alignment tolerance',
      boxes: [
        box('a', 0, 0, 200, 100),
        box('b', 240, 12, 200, 100),
        box('c', 10, 160, 200, 100),
        box('d', 240, 150, 200, 100)
      ],
      canAdjustGaps: true,
      rows: 2,
      columns: 2
    },
    {
      name: 'a diagonal',
      boxes: [
        box('a', 0, 0, 100, 100),
        box('b', 150, 150, 100, 100),
        box('c', 300, 300, 100, 100)
      ],
      canAdjustGaps: false,
      rows: 3,
      columns: 3
    },
    {
      name: 'two rows whose columns are offset',
      boxes: messyGrid,
      canAdjustGaps: false,
      rows: 2,
      columns: 2
    },
    {
      name: 'a row where two nodes overlap',
      boxes: [box('a', 0, 0, 200, 100), box('b', 150, 0, 200, 100)],
      canAdjustGaps: false,
      rows: 1,
      columns: 2
    },
    {
      name: 'a single node',
      boxes: [box('a', 0, 0, 200, 100)],
      canAdjustGaps: false,
      rows: 1,
      columns: 1
    }
  ])(
    'allows gap handles for $name: $canAdjustGaps',
    ({ boxes, canAdjustGaps, rows, columns }) => {
      const grid = detectSelectionGrid(boxes)

      expect(grid.canAdjustGaps).toBe(canAdjustGaps)
      expect(grid.rowCount).toBe(rows)
      expect(grid.columnCount).toBe(columns)
    }
  )

  it('places nodes in rows and columns by their current order', () => {
    const grid = detectSelectionGrid(messyGrid)

    expect(
      grid.cells.map(({ box, row, column }) => [box.id, row, column])
    ).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
      ['c', 1, 0],
      ['d', 1, 1]
    ])
  })

  it('splits nodes that share a cell into neighbouring columns', () => {
    const grid = detectSelectionGrid([
      box('a', 0, 0, 200, 100),
      box('b', 20, 10, 200, 100),
      box('c', 0, 200, 200, 100)
    ])

    expect(grid.columnCount).toBe(2)
    expect(
      grid.cells.map(({ box, row, column }) => [box.id, row, column])
    ).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
      ['c', 1, 0]
    ])
  })
})

describe('computeTidyLayout', () => {
  it.for([
    { y: 150, lowerY: 160, expectedY: 112 },
    { y: 170, lowerY: 160, expectedY: 112 },
    { y: 160, lowerY: 300, expectedY: 0 }
  ])(
    'groups a neighbour at $y with the nearest compatible row at $lowerY',
    ({ y, lowerY, expectedY }) => {
      const boxes = [
        box('a', 0, 0, 200, 400),
        box('b', 240, 0, 200, 100),
        box('c', 240, lowerY, 200, 100),
        box('d', 480, y, 200, 100)
      ]
      const tidied = moved(
        boxes,
        computeTidyLayout(detectSelectionGrid(boxes), 12)
      )

      expect(tidied.map(({ x, y }) => [x, y])).toEqual([
        [0, 0],
        [212, 0],
        [212, 112],
        [424, expectedY]
      ])
      expect(
        moved(tidied, computeTidyLayout(detectSelectionGrid(tidied), 12))
      ).toEqual(tidied)
      expect(
        computeTidyLayout(detectSelectionGrid([...boxes].reverse()), 12)
      ).toEqual(computeTidyLayout(detectSelectionGrid(boxes), 12))
    }
  )

  it('preserves a fractional explicit gap on subsequent default tidy', () => {
    const boxes = Array.from({ length: 4 }, (_, i) =>
      box(String(i), 150 * i, 0, 100, 100)
    )
    const tidied = moved(
      boxes,
      computeTidyLayout(detectSelectionGrid(boxes), 12.4)
    )
    const grid = detectSelectionGrid(tidied)

    expect(computeTidyLayout(grid, tidyGapOf(grid))).toEqual([
      { id: '0', x: 0, y: 0 },
      { id: '1', x: expect.closeTo(112.4, 10), y: 0 },
      { id: '2', x: expect.closeTo(224.8, 10), y: 0 },
      { id: '3', x: expect.closeTo(337.2, 10), y: 0 }
    ])
    expect(tidiedGapOf(tidied)).toBeCloseTo(12.4)
  })

  it('aligns a row by its top edge and evens its gaps to the median gap', () => {
    const boxes = [
      box('a', 100, 50, 200, 100),
      box('b', 330, 75, 150, 300),
      box('c', 530, 60, 180, 120),
      box('d', 750, 40, 100, 100)
    ]

    const grid = detectSelectionGrid(boxes)
    const tidied = moved(boxes, computeTidyLayout(grid, tidyGapOf(grid)))

    expect(tidied.map((b) => b.y)).toEqual([50, 50, 50, 50])
    expect([
      gapBetween(tidied, 'a', 'b', 'x'),
      gapBetween(tidied, 'b', 'c', 'x'),
      gapBetween(tidied, 'c', 'd', 'x')
    ]).toEqual([40, 40, 40])
  })

  it('aligns a grid by top and left edges with its median gap', () => {
    const grid = detectSelectionGrid(messyGrid)
    expect(computeTidyLayout(grid, tidyGapOf(grid))).toEqual([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 287, y: 0 },
      { id: 'c', x: 0, y: 187 },
      { id: 'd', x: 287, y: 187 }
    ])
  })

  it('packs a row under the nodes above it, not under a tall node in another column', () => {
    const boxes = [
      box('sampler', 0, 0, 300, 400),
      box('decode', 320, 0, 200, 150),
      box('save', 540, 0, 240, 500),
      box('vae', 10, 430, 280, 120)
    ]

    const grid = detectSelectionGrid(boxes)
    const tidied = moved(boxes, computeTidyLayout(grid, tidyGapOf(grid)))

    expect(byId(tidied, 'vae')).toMatchObject({ x: 0, y: 420 })
    expect(detectSelectionGrid(tidied).canAdjustGaps).toBe(true)
  })

  it('falls back to whole rows and columns when packing would overlap nodes', () => {
    const boxes = [
      box('big', 0, 0, 300, 300),
      box('short', 700, 0, 100, 50),
      box('middle', 320, 320, 100, 100),
      box('narrow', 0, 650, 50, 100)
    ]

    const tidied = moved(
      boxes,
      computeTidyLayout(detectSelectionGrid(boxes), 12)
    )

    expect(byId(tidied, 'middle')).toMatchObject({ x: 312, y: 312 })
    expect(overlapping(tidied)).toBe(false)
  })

  it('uses the gap it is given', () => {
    const tidied = moved(
      messyGrid,
      computeTidyLayout(detectSelectionGrid(messyGrid), 20)
    )

    expect(gapBetween(tidied, 'c', 'd', 'x')).toBe(20)
    expect(byId(tidied, 'c').y).toBe(160)
  })

  it.for([
    {
      name: 'falls back to a 12 gap when nodes overlap',
      boxes: [box('a', 0, 0, 200, 100), box('b', 150, 0, 200, 100)],
      gap: 12
    },
    {
      name: 'keeps a 0 gap when nodes touch',
      boxes: [box('a', 0, 0, 200, 100), box('b', 200, 0, 200, 100)],
      gap: 0
    }
  ])('$name', ({ boxes, gap }) => {
    const grid = detectSelectionGrid(boxes)
    const tidied = moved(boxes, computeTidyLayout(grid, tidyGapOf(grid)))

    expect(gapBetween(tidied, 'a', 'b', 'x')).toBe(gap)
  })

  it.for([
    { given: Number.NaN, gap: 12 },
    { given: Number.POSITIVE_INFINITY, gap: 12 },
    { given: -30, gap: 0 }
  ])('uses a $gap gap when it is given $given', ({ given, gap }) => {
    const tidied = moved(
      messyGrid,
      computeTidyLayout(detectSelectionGrid(messyGrid), given)
    )

    expect(gapBetween(tidied, 'c', 'd', 'x')).toBe(gap)
    expect(overlapping(tidied)).toBe(false)
  })

  it.for([
    { name: 'is not finite', broken: box('broken', Number.NaN, 0, 100, 100) },
    { name: 'has no width', broken: box('broken', 500, 0, 0, 100) },
    { name: 'has a negative height', broken: box('broken', 500, 0, 100, -50) }
  ])('leaves out a node whose geometry $name', ({ broken }) => {
    const positions = computeTidyLayout(
      detectSelectionGrid([...messyGrid, broken]),
      12
    )

    expect(positions.map((position) => position.id)).not.toContain('broken')
    expect(positions).toEqual(
      computeTidyLayout(detectSelectionGrid(messyGrid), 12)
    )
  })

  it.for([
    {
      name: 'a gap too large to add up',
      boxes: [box('a', 0, 0, 1, 1), box('b', 2, 0, 1, 1), box('c', 4, 0, 1, 1)],
      gap: 1e308
    },
    {
      name: 'extreme coordinates and gaps that overflow placement',
      boxes: [
        box('a', -0.9 * Number.MAX_VALUE, 0, 1, 1),
        box('b', 0, 0, 1, 1),
        box('c', 0.9 * Number.MAX_VALUE, 0, 1, 1)
      ],
      gap: Number.MAX_VALUE
    }
  ])('returns nothing for $name', ({ boxes, gap }) => {
    expect(computeTidyLayout(detectSelectionGrid(boxes), gap)).toEqual([])
  })

  it('keeps nodes that face each other a full gap apart', () => {
    const boxes = [
      box('a', 0, 0, 10, 10),
      box('b', 50, 0, 10, 22),
      box('c', 0, 50, 30, 10)
    ]

    const tidied = moved(
      boxes,
      computeTidyLayout(detectSelectionGrid(boxes), 12)
    )

    expect(byId(tidied, 'c').y - 22).toBeGreaterThanOrEqual(12)
    expect(overlapping(tidied)).toBe(false)
  })

  it('keeps the top-left node in place when the top row starts further right', () => {
    const boxes = [
      box('top', 400, 0, 200, 100),
      box('left', 0, 160, 200, 100),
      box('right', 380, 170, 200, 100)
    ]

    const tidied = moved(
      boxes,
      computeTidyLayout(detectSelectionGrid(boxes), 120)
    )

    expect(byId(tidied, 'top')).toMatchObject({ x: 400, y: 0 })
    expect(byId(tidied, 'right').x).toBe(400)
    expect(gapBetween(tidied, 'left', 'right', 'x')).toBe(120)
  })

  it.for([
    { name: 'a messy grid', boxes: messyGrid },
    {
      name: 'a layout that falls back to whole rows and columns',
      boxes: [
        box('big', 0, 0, 300, 300),
        box('short', 700, 0, 100, 50),
        box('middle', 320, 320, 100, 100),
        box('narrow', 0, 650, 50, 100)
      ]
    },
    {
      name: 'a node below the short one of a tall and a short pair',
      boxes: [
        box('tall', 0, 0, 200, 400),
        box('short', 240, 0, 200, 100),
        box('below', 480, 420, 200, 100)
      ]
    },
    {
      name: 'a node below and beside the narrow one of a wide and a narrow pair',
      boxes: [
        box('wide', 0, 0, 200, 100),
        box('narrow', 0, 112, 100, 100),
        box('beside', 212, 224, 100, 100)
      ]
    },
    {
      name: 'a sparse grid of small nodes',
      boxes: [
        box('a', 0, 0, 10, 10),
        box('b', 150, 0, 10, 10),
        box('c', 0, 50, 10, 10),
        box('d', 50, 50, 10, 10),
        box('e', 100, 100, 10, 10)
      ]
    }
  ])('leaves $name where it is after the first tidy', ({ boxes }) => {
    const grid = detectSelectionGrid(boxes)
    const tidied = moved(boxes, computeTidyLayout(grid, tidyGapOf(grid)))
    const tidiedGrid = detectSelectionGrid(tidied)

    expect(
      moved(tidied, computeTidyLayout(tidiedGrid, tidyGapOf(tidiedGrid)))
    ).toEqual(tidied)
  })

  it.for([
    { name: 'no nodes', boxes: [] },
    { name: 'one node', boxes: [box('a', 0, 0, 100, 100)] }
  ])('returns nothing for $name', ({ boxes }) => {
    expect(computeTidyLayout(detectSelectionGrid(boxes), 12)).toEqual([])
  })
})

describe('tidiedGapOf', () => {
  const tidied = moved(
    messyGrid,
    computeTidyLayout(detectSelectionGrid(messyGrid), 20)
  )

  it.for<{ name: string; boxes: LayoutBox[]; gap: number | undefined }>([
    { name: 'a grid tidied at 20', boxes: tidied, gap: 20 },
    {
      name: 'a tidied grid with one gap widened by hand',
      boxes: tidied.map((b) => (b.id === 'd' ? { ...b, x: b.x + 30 } : b)),
      gap: undefined
    },
    {
      name: 'a pair whose only gap was dragged past the slider range',
      boxes: [box('a', 0, 0, 100, 100), box('b', 160, 0, 100, 100)],
      gap: 60
    },
    {
      name: 'a single node',
      boxes: [box('a', 0, 0, 100, 100)],
      gap: undefined
    },
    {
      name: 'nodes without finite geometry',
      boxes: [
        box('a', Number.NaN, 0, 100, 100),
        box('b', 0, Number.NaN, 100, 100)
      ],
      gap: undefined
    }
  ])('reads $name as $gap', ({ boxes, gap }) => {
    expect(tidiedGapOf(boxes)).toBe(gap)
  })
})

describe('tidyGapOf', () => {
  it('keeps a wide gap within the slider range', () => {
    const row = [box('a', 0, 0, 100, 100), box('b', 300, 0, 100, 100)]

    expect(tidyGapOf(detectSelectionGrid(row))).toBe(MAX_TIDY_GAP)
  })
})

describe('computeGapLayout', () => {
  const row = [
    box('a', 100, 50, 200, 100),
    box('b', 310, 60, 150, 300),
    box('c', 520, 40, 180, 120)
  ]

  it('changes only the dragged gap in a row', () => {
    const result = moved(
      row,
      computeGapLayout(detectSelectionGrid(row), 'x', 0, 20)
    )

    expect(byId(result, 'a')).toEqual(byId(row, 'a'))
    expect([
      gapBetween(result, 'a', 'b', 'x'),
      gapBetween(result, 'b', 'c', 'x')
    ]).toEqual([30, 60])
  })

  it.for<{
    axis: GapAxis
    still: GapAxis
    fixed: string[]
    coordinates: number[]
  }>([
    { axis: 'x', still: 'y', fixed: ['a', 'c'], coordinates: [0, 335, 0, 335] },
    { axis: 'y', still: 'x', fixed: ['a', 'b'], coordinates: [0, 0, 275, 275] }
  ])(
    'moves only the grid nodes after the gap, along $axis',
    ({ axis, still, fixed, coordinates }) => {
      const result = moved(
        alignedGrid,
        computeGapLayout(detectSelectionGrid(alignedGrid), axis, 0, 75)
      )

      expect(result.map((b) => b[still])).toEqual(
        alignedGrid.map((b) => b[still])
      )
      expect(result.map((b) => b[axis])).toEqual(coordinates)
      expect(fixed.map((id) => byId(result, id))).toEqual(
        fixed.map((id) => byId(alignedGrid, id))
      )
    }
  )

  it('returns nothing for a gap index outside the grid', () => {
    expect(computeGapLayout(detectSelectionGrid(row), 'y', 0, 30)).toEqual([])
  })
})

describe('computeGapBars', () => {
  it('returns every handle for an 800-box row without overflowing arguments', () => {
    const boxes = Array.from({ length: 800 }, (_, i) =>
      box(String(i), 112 * i, 0, 100, 100)
    )
    const bars = computeGapBars(detectSelectionGrid(boxes))

    expect(bars).toHaveLength(799)
    expect(
      new Set(bars.map(({ gap, clearance }) => `${gap}:${clearance}`))
    ).toEqual(new Set(['12:12']))
  }, 30_000)

  it('puts a bar in each gap between neighbours of a grid', () => {
    const bars = computeGapBars(
      detectSelectionGrid([
        box('a', 0, 0, 200, 100),
        box('b', 240, 0, 200, 100),
        box('c', 0, 140, 200, 100),
        box('d', 240, 140, 200, 100)
      ])
    )

    expect(bars.map(({ key, ...bar }) => bar)).toEqual([
      { axis: 'x', boundary: 0, clearance: 40, x: 220, y: 50, gap: 40 },
      { axis: 'x', boundary: 0, clearance: 40, x: 220, y: 190, gap: 40 },
      { axis: 'y', boundary: 0, clearance: 40, x: 100, y: 120, gap: 40 },
      { axis: 'y', boundary: 0, clearance: 40, x: 340, y: 120, gap: 40 }
    ])
  })

  it('centres each bar between its own two nodes and limits it to the closest clearance across the gap', () => {
    const bars = computeGapBars(detectSelectionGrid(alignedGrid))

    expect(bars.find((bar) => bar.axis === 'x' && bar.y === 50)).toMatchObject({
      x: 230,
      gap: 60,
      clearance: 20
    })
    expect(bars.find((bar) => bar.axis === 'y' && bar.x === 310)).toMatchObject(
      {
        y: 180,
        gap: 40,
        clearance: 40
      }
    )
  })

  it('gives a different key to each pair of neighbours, whatever their ids', () => {
    const bars = computeGapBars(
      detectSelectionGrid([
        box('a:b', 0, 0, 100, 100),
        box('c', 140, 0, 100, 100),
        box('a', 280, 0, 100, 100),
        box('b:c', 420, 0, 100, 100)
      ])
    )

    expect(new Set(bars.map((bar) => bar.key)).size).toBe(bars.length)
  })

  it.for([
    {
      name: 'no nodes face each other across it',
      boxes: [box('a', 0, 0, 100, 100), box('b', 150, 99.6, 100, 0.8)]
    },
    {
      name: 'its own nodes do not face each other but others across it do',
      boxes: [
        box('a', 0, 0, 100, 100),
        box('b', 150, 99.6, 100, 0.8),
        box('c', 300, 50, 100, 50.4)
      ]
    }
  ])('lets a gap close to zero when $name', ({ boxes }) => {
    const bars = computeGapBars(detectSelectionGrid(boxes))

    expect(
      bars.find((bar) => bar.axis === 'x' && bar.boundary === 0)
    ).toMatchObject({
      gap: 50,
      clearance: 50
    })
  })

  it('never lets a gap shrink further when its nodes already overlap a little', () => {
    const boxes = [box('a', 0, 0, 100, 100), box('b', 99.8, 0, 100, 100)]

    const [bar] = computeGapBars(detectSelectionGrid(boxes))

    expect(bar.clearance).toBe(0)
  })

  it('shows no bars for a scattered selection', () => {
    expect(computeGapBars(detectSelectionGrid(messyGrid))).toEqual([])
  })
})
