import { describe, expect, it, vi } from 'vitest'

import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import type { LGraphNode } from '../LGraphNode'
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
