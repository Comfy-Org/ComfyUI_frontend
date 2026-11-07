import { describe, expect, it } from 'vitest'

import {
  computeTidyLayout,
  detectSelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  BoxPosition,
  LayoutBox,
  SelectionLayoutKind
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { toNodeId } from '@/types/nodeId'

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
    kind: SelectionLayoutKind
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
      kind: 'row',
      rows: 1,
      columns: 3
    },
    {
      name: 'a short node centred beside a tall one',
      boxes: [box('a', 0, 0, 200, 600), box('b', 240, 250, 150, 100)],
      kind: 'row',
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
      kind: 'row',
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
      kind: 'scattered',
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
      kind: 'scattered',
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
      kind: 'row',
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
      kind: 'row',
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
      kind: 'row',
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
      kind: 'scattered',
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
      kind: 'column',
      rows: 3,
      columns: 1
    },
    {
      name: 'an aligned 2x2 grid of mixed sizes',
      boxes: alignedGrid,
      kind: 'grid',
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
      kind: 'grid',
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
      kind: 'grid',
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
      kind: 'scattered',
      rows: 3,
      columns: 3
    },
    {
      name: 'two rows whose columns are offset',
      boxes: messyGrid,
      kind: 'scattered',
      rows: 2,
      columns: 2
    },
    {
      name: 'a row where two nodes overlap',
      boxes: [box('a', 0, 0, 200, 100), box('b', 150, 0, 200, 100)],
      kind: 'scattered',
      rows: 1,
      columns: 2
    },
    {
      name: 'a single node',
      boxes: [box('a', 0, 0, 200, 100)],
      kind: 'scattered',
      rows: 1,
      columns: 1
    }
  ])('reads $name as $kind', ({ boxes, kind, rows, columns }) => {
    const grid = detectSelectionGrid(boxes)

    expect(grid.kind).toBe(kind)
    expect(grid.rowCount).toBe(rows)
    expect(grid.columnCount).toBe(columns)
  })

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
  it('aligns a row by its top edge and evens its gaps to the median gap', () => {
    const boxes = [
      box('a', 100, 50, 200, 100),
      box('b', 330, 75, 150, 300),
      box('c', 530, 60, 180, 120),
      box('d', 750, 40, 100, 100)
    ]

    const tidied = moved(boxes, computeTidyLayout(boxes))

    expect(tidied.map((b) => b.y)).toEqual([50, 50, 50, 50])
    expect([
      gapBetween(tidied, 'a', 'b', 'x'),
      gapBetween(tidied, 'b', 'c', 'x'),
      gapBetween(tidied, 'c', 'd', 'x')
    ]).toEqual([40, 40, 40])
  })

  it('aligns a grid by top and left edges with its median gap', () => {
    expect(computeTidyLayout(messyGrid)).toEqual([
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

    const tidied = moved(boxes, computeTidyLayout(boxes))

    expect(byId(tidied, 'vae')).toMatchObject({ x: 0, y: 420 })
    expect(detectSelectionGrid(tidied).kind).toBe('grid')
  })

  it('falls back to whole rows and columns when packing would overlap nodes', () => {
    const boxes = [
      box('big', 0, 0, 300, 300),
      box('short', 700, 0, 100, 50),
      box('middle', 320, 320, 100, 100),
      box('narrow', 0, 650, 50, 100)
    ]

    const tidied = moved(boxes, computeTidyLayout(boxes, 12))

    expect(byId(tidied, 'middle')).toMatchObject({ x: 312, y: 312 })
    expect(overlapping(tidied)).toBe(false)
  })

  it('uses the gap it is given', () => {
    const tidied = moved(messyGrid, computeTidyLayout(messyGrid, 20))

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
    const tidied = moved(boxes, computeTidyLayout(boxes))

    expect(gapBetween(tidied, 'a', 'b', 'x')).toBe(gap)
  })

  it.for([
    { given: Number.NaN, gap: 12 },
    { given: Number.POSITIVE_INFINITY, gap: 12 },
    { given: -30, gap: 0 }
  ])('uses a $gap gap when it is given $given', ({ given, gap }) => {
    const tidied = moved(messyGrid, computeTidyLayout(messyGrid, given))

    expect(gapBetween(tidied, 'c', 'd', 'x')).toBe(gap)
    expect(overlapping(tidied)).toBe(false)
  })

  it.for([
    { name: 'is not finite', broken: box('broken', Number.NaN, 0, 100, 100) },
    { name: 'has no width', broken: box('broken', 500, 0, 0, 100) },
    { name: 'has a negative height', broken: box('broken', 500, 0, 100, -50) }
  ])('leaves out a node whose geometry $name', ({ broken }) => {
    const positions = computeTidyLayout([...messyGrid, broken])

    expect(positions.map((position) => position.id)).not.toContain('broken')
    expect(positions).toEqual(computeTidyLayout(messyGrid))
  })

  it.for([
    {
      name: 'a gap too large to add up',
      boxes: [box('a', 0, 0, 1, 1), box('b', 2, 0, 1, 1), box('c', 4, 0, 1, 1)],
      gap: 1e308
    },
    {
      name: 'gaps too large to average',
      boxes: [
        box('a', -0.9 * Number.MAX_VALUE, 0, 1, 1),
        box('b', 0, 0, 1, 1),
        box('c', 0.9 * Number.MAX_VALUE, 0, 1, 1)
      ],
      gap: undefined
    }
  ])('returns nothing for $name', ({ boxes, gap }) => {
    expect(computeTidyLayout(boxes, gap)).toEqual([])
  })

  it('keeps nodes that face each other a full gap apart', () => {
    const boxes = [
      box('a', 0, 0, 10, 10),
      box('b', 50, 0, 10, 22),
      box('c', 0, 50, 30, 10)
    ]

    const tidied = moved(boxes, computeTidyLayout(boxes, 12))

    expect(byId(tidied, 'c').y - 22).toBeGreaterThanOrEqual(12)
    expect(overlapping(tidied)).toBe(false)
  })

  it('keeps the top-left node in place when the top row starts further right', () => {
    const boxes = [
      box('top', 400, 0, 200, 100),
      box('left', 0, 160, 200, 100),
      box('right', 380, 170, 200, 100)
    ]

    const tidied = moved(boxes, computeTidyLayout(boxes))

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
    const tidied = moved(boxes, computeTidyLayout(boxes))

    expect(moved(tidied, computeTidyLayout(tidied))).toEqual(tidied)
  })

  it.for([
    { name: 'no nodes', boxes: [] },
    { name: 'one node', boxes: [box('a', 0, 0, 100, 100)] }
  ])('returns nothing for $name', ({ boxes }) => {
    expect(computeTidyLayout(boxes)).toEqual([])
  })
})
