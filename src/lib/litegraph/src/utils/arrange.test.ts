import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  alignBoxes,
  alignNodes,
  distributeNodes,
  laneBox,
  lanesAlong,
  nodePlacement,
  positionForBox
} from './arrange'
import type { AlignAction } from './arrange'

const a = { x: 10, y: 0, width: 100, height: 60, titleHeight: 30 }
const b = { x: 200, y: 50, width: 40, height: 90, titleHeight: 0 }

describe('alignBoxes', () => {
  it.for<{
    action: AlignAction
    axis: 'x' | 'y'
    expected: [number, number]
  }>([
    { action: 'left', axis: 'x', expected: [10, 10] },
    { action: 'center', axis: 'x', expected: [75, 105] },
    { action: 'right', axis: 'x', expected: [140, 200] },
    { action: 'middle', axis: 'y', expected: [40, 25] },
    { action: 'bottom', axis: 'y', expected: [80, 50] }
  ])('$action moves only along $axis', ({ action, axis, expected }) => {
    const [first, second] = alignBoxes([a, b], action)
    expect([first[axis], second[axis]]).toEqual(expected)
  })

  it('aligns body tops so headed and headless nodes line up their bodies', () => {
    const [first, second] = alignBoxes([a, b], 'top')
    expect([
      first.y + first.titleHeight,
      second.y + second.titleHeight
    ]).toEqual([30, 30])
  })

  it('matches body height, keeping each box its own title', () => {
    const [first, second] = alignBoxes([a, b], 'matchHeight')
    expect([first.height, second.height]).toEqual([120, 90])
  })

  it('matches width to the widest box', () => {
    const [first, second] = alignBoxes([a, b], 'matchWidth')
    expect([first.width, second.width]).toEqual([100, 100])
  })

  it('distributes vertically between the fixed top and bottom boxes', () => {
    const column = [
      { x: 0, y: 0, width: 10, height: 100, titleHeight: 0 },
      { x: 0, y: 130, width: 10, height: 20, titleHeight: 0 },
      { x: 0, y: 500, width: 10, height: 50, titleHeight: 0 }
    ]
    expect(alignBoxes(column, 'distributeY').map((box) => box.y)).toEqual([
      0, 290, 500
    ])
  })

  it('moves a selected grid column by column, keeping each column aligned', () => {
    const cell = (x: number, y: number) => ({
      x,
      y,
      width: 100,
      height: 50,
      titleHeight: 0
    })
    const grid = [
      cell(0, 0),
      cell(150, 0),
      cell(400, 0),
      cell(0, 100),
      cell(150, 100),
      cell(400, 100)
    ]
    expect(alignBoxes(grid, 'distributeX').map((box) => box.x)).toEqual([
      0, 200, 400, 0, 200, 400
    ])
  })

  it('keeps boxes that only slightly overlap in separate lanes', () => {
    const column = [
      { x: 0, y: 0, width: 10, height: 100, titleHeight: 0 },
      { x: 0, y: 90, width: 10, height: 40, titleHeight: 0 },
      { x: 0, y: 300, width: 10, height: 50, titleHeight: 0 }
    ]
    expect(alignBoxes(column, 'distributeY').map((box) => box.y)).toEqual([
      0, 180, 300
    ])
  })

  it('leaves lanes alone when they are too wide to fit between the outer ones', () => {
    const crowded = [
      { x: 0, y: 0, width: 100, height: 10, titleHeight: 0 },
      { x: 60, y: 0, width: 100, height: 10, titleHeight: 0 },
      { x: 130, y: 0, width: 100, height: 10, titleHeight: 0 }
    ]
    expect(alignBoxes(crowded, 'distributeX')).toEqual(crowded)
  })

  it('treats boxes inside another box along the axis as one lane, so none swap order', () => {
    const crowded = [
      { x: 0, y: 0, width: 300, height: 10, titleHeight: 0 },
      { x: 50, y: 20, width: 50, height: 10, titleHeight: 0 },
      { x: 100, y: 40, width: 50, height: 10, titleHeight: 0 }
    ]
    expect(alignBoxes(crowded, 'distributeX')).toEqual(crowded)
  })

  it('distributes the middle boxes evenly between fixed outer boxes', () => {
    const boxes = [
      { x: 0, y: 0, width: 100, height: 10, titleHeight: 0 },
      { x: 500, y: 0, width: 50, height: 10, titleHeight: 0 },
      { x: 130, y: 0, width: 20, height: 10, titleHeight: 0 }
    ]
    expect(alignBoxes(boxes, 'distributeX').map((box) => box.x)).toEqual([
      0, 500, 290
    ])
  })
})

describe('positionForBox', () => {
  it('keeps the offset an onBounding hook adds between position and box', () => {
    const node = new LGraphNode('Padded')
    node.pos = [100, 200]
    node.size = [150, 60]
    node.onBounding = (bounds) => {
      bounds[0] -= 10
    }
    node.updateArea()
    const placement = nodePlacement(node)

    const moved = {
      ...placement.box,
      x: placement.box.x + 30,
      y: placement.box.y + 5
    }
    expect(positionForBox(placement, moved)).toEqual({ x: 130, y: 205 })
  })
})

function nodeAt(pos: [number, number], size: [number, number]) {
  const node = new LGraphNode('Node')
  node.pos = pos
  node.size = size
  node.updateArea()
  return node
}

describe('alignNodes', () => {
  it.for<{ direction: 'left' | 'top'; axis: 0 | 1; expected: number }>([
    { direction: 'left', axis: 0, expected: 200 },
    { direction: 'top', axis: 1, expected: 300 }
  ])(
    'lines nodes up on the $direction edge of align_to, not the selection',
    ({ direction, axis, expected }) => {
      const first = nodeAt([0, 100], [100, 50])
      const reference = nodeAt([200, 300], [80, 40])
      const positions = alignNodes([first, reference], direction, reference)
      expect(positions.map(({ newPos }) => [newPos.x, newPos.y][axis])).toEqual(
        [expected, expected]
      )
    }
  )
})

describe('distributeNodes', () => {
  it('evens the visual gaps without moving the outer nodes or mutating any', () => {
    const nodes = [
      nodeAt([0, 30], [100, 40]),
      nodeAt([0, 130], [100, 20]),
      nodeAt([0, 430], [100, 40])
    ]
    const positions = distributeNodes(nodes)
    expect(positions.map(({ newPos }) => newPos.y)).toEqual([30, 240, 430])
    expect(nodes[1].pos[1]).toBe(130)
  })

  it.for<{
    name: string
    lefts: number[]
    expected: number[]
  }>([
    {
      name: 'crowded nodes that share one column stay put',
      lefts: [0, 10, 60],
      expected: [0, 10, 60]
    },
    {
      name: 'two nodes stay put',
      lefts: [0, 300],
      expected: [0, 300]
    },
    {
      name: 'positions come back in input order, not sorted order',
      lefts: [400, 0, 150],
      expected: [400, 0, 200]
    }
  ])('horizontally, $name', ({ lefts, expected }) => {
    const nodes = lefts.map((x, i) => nodeAt([x, i * 200], [100, 40]))
    const positions = distributeNodes(nodes, true)
    expect(positions.map(({ newPos }) => newPos.x)).toEqual(expected)
  })
})

describe('lanesAlong', () => {
  it('reports the lanes a distribution moved as units, evenly spaced as lane boxes', () => {
    const boxes = [0, 105, 125, 500].map((x, i) => ({
      x,
      y: i * 20,
      width: 100,
      height: 10,
      titleHeight: 0
    }))
    const after = alignBoxes(boxes, 'distributeX')
    const lanes = lanesAlong(after, 'x')
    expect(after.map((box) => box.x)).toEqual([0, 240, 260, 500])
    expect(lanes).toEqual([[0], [1, 2], [3]])
    expect(
      lanes.map((lane) => {
        const { x, width } = laneBox(
          lane.map((i) => after[i]),
          'x'
        )
        return [x, width]
      })
    ).toEqual([
      [0, 100],
      [240, 120],
      [500, 100]
    ])
  })
})
