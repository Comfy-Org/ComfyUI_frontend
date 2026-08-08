import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '../LGraphNode'
import type { Direction } from '../interfaces'
import { alignNodes, distributeNodes, getBoundaryNodes } from './arrange'

function createNode(pos: [number, number], size: [number, number]): LGraphNode {
  const node = {
    pos: [...pos],
    size: [...size],
    setPos: vi.fn((x: number, y: number) => {
      node.pos = [x, y]
    })
  }

  return fromAny<LGraphNode, unknown>(node)
}

describe('getBoundaryNodes', () => {
  it('returns null when there are no nodes', () => {
    expect(getBoundaryNodes([])).toBeNull()
  })

  it('finds the farthest node in each direction', () => {
    const top = createNode([20, -10], [10, 10])
    const right = createNode([80, 10], [30, 10])
    const bottom = createNode([10, 40], [10, 30])
    const left = createNode([-15, 0], [10, 10])

    expect(getBoundaryNodes([top, right, bottom, left])).toEqual({
      top,
      right,
      bottom,
      left
    })
  })
})

describe('distributeNodes', () => {
  it('returns no positions when fewer than two nodes are provided', () => {
    expect(distributeNodes([])).toEqual([])
    expect(distributeNodes([createNode([0, 0], [10, 10])])).toEqual([])
  })

  it('distributes nodes horizontally by preserving boundary edges', () => {
    const first = createNode([0, 0], [10, 10])
    const second = createNode([40, 0], [20, 10])
    const third = createNode([100, 0], [10, 10])

    const positions = distributeNodes([third, first, second], true)

    expect(positions.map(({ node, newPos }) => [node, newPos.x])).toEqual([
      [first, 0],
      [second, 45],
      [third, 100]
    ])
  })

  it('distributes nodes vertically by preserving boundary edges', () => {
    const first = createNode([0, 0], [10, 10])
    const second = createNode([0, 30], [10, 20])
    const third = createNode([0, 90], [10, 10])

    const positions = distributeNodes([third, first, second])

    expect(positions.map(({ node, newPos }) => [node, newPos.y])).toEqual([
      [first, 0],
      [second, 40],
      [third, 90]
    ])
  })
})

describe('alignNodes', () => {
  it.for([
    { direction: 'left', expectedPos: [10, 25] },
    { direction: 'right', expectedPos: [70, 25] },
    { direction: 'top', expectedPos: [40, 5] },
    { direction: 'bottom', expectedPos: [40, 45] }
  ] satisfies Array<{ direction: Direction; expectedPos: [number, number] }>)(
    'aligns nodes to the $direction boundary',
    ({ direction, expectedPos }) => {
      const boundary = createNode([10, 5], [80, 60])
      const node = createNode([40, 25], [20, 20])

      const [position] = alignNodes([boundary, node], direction)

      expect(position.node).toBe(boundary)
      expect(node.pos).toEqual(expectedPos)
    }
  )

  it('aligns to an explicit target node', () => {
    const target = createNode([100, 200], [50, 60])
    const node = createNode([0, 0], [10, 20])

    alignNodes([node], 'bottom', target)

    expect(node.pos).toEqual([0, 240])
  })
})
