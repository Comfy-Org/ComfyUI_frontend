import { describe, expect, it } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { alignNodes, distributeNodes } from './arrange'

let nextId = 0

function nodeAt(pos: [number, number], size: [number, number]) {
  const node = new LGraphNode('Node')
  node.id = toNodeId(++nextId)
  node.pos = pos
  node.size = size
  node.updateArea()
  return node
}

function undrawnNodeAt(pos: [number, number], size: [number, number]) {
  const node = new LGraphNode('Node')
  node.id = toNodeId(++nextId)
  node.pos = pos
  node.size = size
  return node
}

function pinnedNodeAt(pos: [number, number], size: [number, number]) {
  const node = nodeAt(pos, size)
  node.flags.pinned = true
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

describe('pinned nodes', () => {
  it('alignNodes leaves a pinned node where it is and returns no position for it', () => {
    const pinned = pinnedNodeAt([0, 0], [100, 50])
    const free = nodeAt([200, 100], [100, 50])
    const reference = nodeAt([300, 400], [80, 40])
    const positions = alignNodes([pinned, free, reference], 'left', reference)
    expect(positions.map(({ node, newPos }) => [node, newPos.x])).toEqual([
      [free, 300],
      [reference, 300]
    ])
  })

  it('a pinned node still sets the edge the others line up on', () => {
    const pinned = pinnedNodeAt([50, 0], [100, 50])
    const free = nodeAt([200, 100], [100, 50])
    const positions = alignNodes([pinned, free], 'left')
    expect(positions.map(({ node, newPos }) => [node, newPos.x])).toEqual([
      [free, 50]
    ])
  })

  it('distributeNodes spaces only the unpinned nodes', () => {
    const nodes = [0, 150, 400, 600].map((x, i) =>
      (i === 3 ? pinnedNodeAt : nodeAt)([x, i * 200], [100, 40])
    )
    const positions = distributeNodes(nodes, 'x')
    expect(positions.map(({ newPos }) => newPos.x)).toEqual([0, 200, 400])
  })
})

describe('nodes that have not been drawn yet', () => {
  it('alignNodes measures them instead of reading an empty rect', () => {
    const drawn = nodeAt([500, 0], [100, 50])
    const undrawn = undrawnNodeAt([900, 100], [100, 50])
    const positions = alignNodes([drawn, undrawn], 'left')
    expect(positions.map(({ newPos }) => newPos.x)).toEqual([500, 500])
  })
})

describe('distributeNodes', () => {
  it('evens the visual gaps without moving the outer nodes or mutating any', () => {
    const nodes = [
      nodeAt([0, 30], [100, 40]),
      nodeAt([0, 130], [100, 20]),
      nodeAt([0, 430], [100, 40])
    ]
    const positions = distributeNodes(nodes, 'y')
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
    const positions = distributeNodes(nodes, 'x')
    expect(positions.map(({ newPos }) => newPos.x)).toEqual(expected)
  })
})
