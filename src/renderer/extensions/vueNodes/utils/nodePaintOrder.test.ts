import { describe, expect, it } from 'vitest'

import type { NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'

import { orderNodesForPainting } from './nodePaintOrder'

interface TestNode {
  id: ReturnType<typeof toNodeId>
  flags?: {
    collapsed?: boolean
  }
}

function node(id: number, collapsed = false): TestNode {
  return {
    id: toNodeId(id),
    flags: collapsed ? { collapsed } : undefined
  }
}

function layouts(
  entries: Array<[TestNode, number]>
): Map<TestNode['id'], Pick<NodeLayout, 'zIndex'>> {
  return new Map(entries.map(([node, zIndex]) => [node.id, { zIndex }]))
}

function ids(nodes: TestNode[]): TestNode['id'][] {
  return nodes.map(({ id }) => id)
}

describe('orderNodesForPainting', () => {
  it('orders inactive collapsed, expanded, and selected collapsed tiers', () => {
    const expanded = node(1)
    const selectedCollapsed = node(2, true)
    const inactiveCollapsed = node(3, true)

    const result = orderNodesForPainting(
      [expanded, selectedCollapsed, inactiveCollapsed],
      layouts([
        [expanded, 0],
        [selectedCollapsed, -100],
        [inactiveCollapsed, 100]
      ]),
      new Set([selectedCollapsed.id])
    )

    expect(ids(result)).toEqual([
      inactiveCollapsed.id,
      expanded.id,
      selectedCollapsed.id
    ])
  })

  it('preserves z-index order within each tier', () => {
    const collapsedFront = node(1, true)
    const expandedFront = node(2)
    const collapsedBack = node(3, true)
    const expandedBack = node(4)

    const result = orderNodesForPainting(
      [collapsedFront, expandedFront, collapsedBack, expandedBack],
      layouts([
        [collapsedFront, 8],
        [expandedFront, 9],
        [collapsedBack, 2],
        [expandedBack, 3]
      ]),
      new Set()
    )

    expect(ids(result)).toEqual([
      collapsedBack.id,
      collapsedFront.id,
      expandedBack.id,
      expandedFront.id
    ])
  })

  it('keeps original order when z-indices tie', () => {
    const first = node(1)
    const second = node(2)

    const result = orderNodesForPainting(
      [first, second],
      layouts([
        [first, 4],
        [second, 4]
      ]),
      new Set()
    )

    expect(ids(result)).toEqual([first.id, second.id])
  })

  it('keeps nodes without layouts in their original tier positions', () => {
    const front = node(1)
    const missing = node(2)
    const back = node(3)

    const result = orderNodesForPainting(
      [front, missing, back],
      layouts([
        [front, 8],
        [back, 2]
      ]),
      new Set()
    )

    expect(ids(result)).toEqual([back.id, missing.id, front.id])
  })

  it('promotes every selected collapsed node', () => {
    const selectedBack = node(1, true)
    const expanded = node(2)
    const selectedFront = node(3, true)

    const result = orderNodesForPainting(
      [selectedBack, expanded, selectedFront],
      layouts([
        [selectedBack, 1],
        [expanded, 100],
        [selectedFront, 5]
      ]),
      new Set([selectedBack.id, selectedFront.id])
    )

    expect(ids(result)).toEqual([
      expanded.id,
      selectedBack.id,
      selectedFront.id
    ])
  })
})
