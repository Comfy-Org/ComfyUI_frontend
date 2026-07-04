import { describe, expect, it, vi } from 'vitest'

import type { Direction } from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { alignNodes, distributeNodes, getBoundaryNodes } from './arrange'

function nodeFixture(
  title: string,
  pos: [number, number],
  size: [number, number]
): LGraphNode {
  const graphNode = {
    title,
    pos,
    size,
    setPos: vi.fn((x: number, y: number) => {
      graphNode.pos = [x, y]
    })
  }

  return createMockLGraphNode(graphNode)
}

function createNode(x: number, y: number, width: number, height: number) {
  const node = new LGraphNode('Test Node')
  node.pos = [x, y]
  node.size = [width, height]
  return node
}

describe('arrange utilities', () => {
  it('returns null when no boundary node is available', () => {
    expect(getBoundaryNodes([])).toBeNull()
    expect(getBoundaryNodes(undefined)).toBeNull()
  })

  it('finds the furthest node in each direction', () => {
    const top = nodeFixture('top', [10, -10], [20, 20])
    const right = nodeFixture('right', [100, 0], [50, 20])
    const bottom = nodeFixture('bottom', [0, 80], [20, 60])
    const left = nodeFixture('left', [-20, 0], [10, 10])

    expect(getBoundaryNodes([top, right, bottom, left])).toEqual({
      top,
      right,
      bottom,
      left
    })
  })

  it('does not distribute zero or one node', () => {
    expect(distributeNodes([])).toEqual([])
    expect(distributeNodes([nodeFixture('single', [0, 0], [10, 10])])).toEqual(
      []
    )
  })

  it('distributes nodes horizontally by sorted position', () => {
    const first = nodeFixture('first', [0, 10], [10, 10])
    const middle = nodeFixture('middle', [30, 20], [10, 10])
    const last = nodeFixture('last', [60, 30], [20, 10])

    const result = distributeNodes([last, first, middle], true)

    expect(result.map(({ node: resultNode }) => resultNode.title)).toEqual([
      'first',
      'middle',
      'last'
    ])
    expect(first.pos).toEqual([0, 10])
    expect(middle.pos).toEqual([30, 20])
    expect(last.pos).toEqual([60, 30])
  })

  it('distributes nodes vertically by sorted position', () => {
    const first = nodeFixture('first', [10, 0], [10, 10])
    const middle = nodeFixture('middle', [20, 30], [10, 10])
    const last = nodeFixture('last', [30, 60], [10, 20])

    distributeNodes([last, first, middle])

    expect(first.pos).toEqual([10, 0])
    expect(middle.pos).toEqual([20, 30])
    expect(last.pos).toEqual([30, 60])
  })

  it('aligns nodes to each boundary edge', () => {
    const nodesForAlign = () => [
      nodeFixture('top', [10, 0], [10, 10]),
      nodeFixture('right', [40, 10], [30, 10]),
      nodeFixture('bottom', [20, 50], [10, 30]),
      nodeFixture('left', [-10, 20], [10, 10])
    ]

    expect(
      alignNodes(nodesForAlign(), 'left').map(({ newPos }) => newPos.x)
    ).toEqual([-10, -10, -10, -10])
    expect(
      alignNodes(nodesForAlign(), 'right').map(({ newPos }) => newPos.x)
    ).toEqual([60, 40, 60, 60])
    expect(
      alignNodes(nodesForAlign(), 'top').map(({ newPos }) => newPos.y)
    ).toEqual([0, 0, 0, 0])
    expect(
      alignNodes(nodesForAlign(), 'bottom').map(({ newPos }) => newPos.y)
    ).toEqual([70, 70, 50, 70])
  })

  it('aligns to an explicit node when provided', () => {
    const anchor = nodeFixture('anchor', [100, 200], [50, 60])
    const target = nodeFixture('target', [0, 0], [10, 20])

    const result = alignNodes([target], 'bottom', anchor)

    expect(result[0].newPos).toEqual({ x: 0, y: 240 })
    expect(target.setPos).toHaveBeenCalledWith(0, 240)
  })

  it('returns no positions when alignment has no usable nodes', () => {
    expect(alignNodes([], 'left')).toEqual([])
    expect(alignNodes(undefined, 'left')).toEqual([])
  })
})

describe('getBoundaryNodes', () => {
  it('returns null when no nodes are supplied', () => {
    expect(getBoundaryNodes([])).toBeNull()
    expect(getBoundaryNodes(undefined)).toBeNull()
  })

  it('returns null when all nodes are falsy', () => {
    expect(getBoundaryNodes([undefined, null])).toBeNull()
  })

  it('returns the same node for all edges with a single node', () => {
    const node = createNode(10, 20, 100, 50)
    expect(getBoundaryNodes([node])).toEqual({
      top: node,
      right: node,
      bottom: node,
      left: node
    })
  })

  it('finds the farthest node in each direction', () => {
    const topLeft = createNode(0, 0, 10, 10)
    const bottomRight = createNode(200, 200, 50, 50)
    const middle = createNode(100, 100, 10, 10)

    const boundary = getBoundaryNodes([middle, topLeft, bottomRight])

    expect(boundary).not.toBeNull()
    expect(boundary?.top).toBe(topLeft)
    expect(boundary?.left).toBe(topLeft)
    expect(boundary?.right).toBe(bottomRight)
    expect(boundary?.bottom).toBe(bottomRight)
  })

  it('skips falsy entries while finding boundaries', () => {
    const node = createNode(5, 5, 10, 10)
    const other = createNode(50, 50, 10, 10)

    const boundary = getBoundaryNodes([node, undefined, other])

    expect(boundary?.left).toBe(node)
    expect(boundary?.right).toBe(other)
  })
})

describe('distributeNodes', () => {
  it('returns an empty array when fewer than two nodes are supplied', () => {
    expect(distributeNodes([])).toEqual([])
    expect(distributeNodes([createNode(0, 0, 10, 10)])).toEqual([])
    expect(distributeNodes(undefined)).toEqual([])
  })

  it('distributes nodes evenly along the horizontal plane', () => {
    const first = createNode(0, 0, 10, 10)
    const last = createNode(100, 0, 20, 10)
    const middle = createNode(30, 0, 10, 10)

    const positions = distributeNodes([first, last, middle], true)

    expect(positions.map(({ node }) => node)).toEqual([first, middle, last])
    // Total span 0..120, widths 10 + 10 + 20 = 40, gap = (120 - 40) / 2 = 40
    expect(first.pos[0]).toBe(0)
    expect(middle.pos[0]).toBe(50)
    expect(last.pos[0]).toBe(100)
    expect(positions.map(({ newPos }) => newPos.x)).toEqual([0, 50, 100])
  })

  it('distributes nodes evenly along the vertical plane by default', () => {
    const first = createNode(0, 0, 10, 10)
    const last = createNode(0, 100, 10, 20)
    const middle = createNode(0, 30, 10, 10)

    const positions = distributeNodes([first, last, middle])

    // Total span 0..120, heights 10 + 10 + 20 = 40, gap = (120 - 40) / 2 = 40
    expect(first.pos[1]).toBe(0)
    expect(middle.pos[1]).toBe(50)
    expect(last.pos[1]).toBe(100)
    expect(positions.map(({ newPos }) => newPos.y)).toEqual([0, 50, 100])
  })
})

describe('alignNodes', () => {
  it('returns an empty array when nodes are not supplied', () => {
    expect(alignNodes(undefined, 'left')).toEqual([])
  })

  it('returns an empty array when boundary nodes cannot be determined', () => {
    expect(alignNodes([], 'left')).toEqual([])
  })

  it.for<[Direction, [number, number], [number, number]]>([
    // Anchor is at [100, 100] with size [50, 50]; node is at [0, 0] size [10, 10].
    ['left', [100, 0], [100, 100]],
    ['right', [140, 0], [100, 100]],
    ['top', [0, 100], [100, 100]],
    ['bottom', [0, 140], [100, 100]]
  ])(
    'aligns nodes to the %s edge of the anchor node',
    ([direction, expectedNodePos, expectedAnchorPos]) => {
      const node = createNode(0, 0, 10, 10)
      const anchor = createNode(100, 100, 50, 50)

      const positions = alignNodes([node, anchor], direction, anchor)

      expect(positions).toHaveLength(2)
      expect([node.pos[0], node.pos[1]]).toEqual(expectedNodePos)
      expect([anchor.pos[0], anchor.pos[1]]).toEqual(expectedAnchorPos)
    }
  )

  it('uses boundary nodes when no anchor is supplied', () => {
    const left = createNode(0, 0, 10, 10)
    const right = createNode(100, 50, 20, 10)

    alignNodes([left, right], 'left')

    expect(left.pos[0]).toBe(0)
    expect(right.pos[0]).toBe(0)
  })
})
