import { describe, expect, it } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import {
  alignBoxes,
  arrangePlacements,
  laneBox,
  lanesAlong,
  placeBox
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

describe('placeBox', () => {
  it('keeps the offset between position and box when the box moves', () => {
    const placement = {
      position: { x: 100, y: 200 },
      box: { x: 90, y: 170, width: 150, height: 90, titleHeight: 30 }
    }
    const moved = { ...placement.box, x: 120, y: 175 }
    expect(placeBox(placement, moved).position).toEqual({ x: 130, y: 205 })
  })
})

describe('arrangePlacements', () => {
  it('returns each new placement under its own node id', () => {
    const placements = new Map([
      [toNodeId(7), { position: { x: 210, y: 80 }, box: { ...b, x: 200 } }],
      [toNodeId(3), { position: { x: 10, y: 30 }, box: a }]
    ])
    const after = arrangePlacements(placements, 'left')
    expect(after.get(toNodeId(7))?.position).toEqual({ x: 20, y: 80 })
    expect(after.get(toNodeId(3))?.position).toEqual({ x: 10, y: 30 })
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
    const ids = ['a', 'b', 'c', 'd'].map(toNodeId)
    const byId = new Map(ids.map((id, i) => [id, after[i]]))
    const lanes = lanesAlong(byId, 'x')
    expect(after.map((box) => box.x)).toEqual([0, 240, 260, 500])
    expect(lanes).toEqual([['a'], ['b', 'c'], ['d']])
    expect(
      lanes.map((lane) => {
        const { x, width } = laneBox(
          lane.flatMap((id) => byId.get(id) ?? []),
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
