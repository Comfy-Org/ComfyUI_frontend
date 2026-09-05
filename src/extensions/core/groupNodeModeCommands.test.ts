import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { toNodeId, type NodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  applyGroupNodeModeCommandBatch,
  createGroupNodeModeCommandBatch
} from './groupNodeModeCommands'

const beforeChange = vi.fn()
const change = vi.fn()
const afterChange = vi.fn()

function makeNode(id: number, mode: LGraphEventMode): LGraphNode {
  return createMockLGraphNode({ id: toNodeId(id), mode })
}

function makeGraph(nodes: LGraphNode[]): LGraph {
  const nodesById = new Map(nodes.map((node) => [String(node.id), node]))
  return fromPartial<LGraph>({
    id: 'graph-id',
    beforeChange,
    change,
    afterChange,
    getNodeById: (id: NodeId | null | undefined) =>
      nodesById.get(String(id)) ?? null
  })
}

beforeEach(() => {
  beforeChange.mockClear()
  change.mockClear()
  afterChange.mockClear()
})

describe('group node mode command batches', () => {
  it('creates deterministic, serializable entries', () => {
    const nodes = [
      makeNode(10, LGraphEventMode.ALWAYS),
      makeNode(2, LGraphEventMode.ON_TRIGGER)
    ]

    const batch = createGroupNodeModeCommandBatch(
      'graph-id',
      nodes,
      LGraphEventMode.BYPASS
    )

    expect(batch).not.toBeNull()
    expect(JSON.parse(JSON.stringify(batch))).toEqual({
      type: 'comfy.groupNodeMode.set',
      version: 1,
      graphId: 'graph-id',
      entries: [
        { nodeId: 2, mode: LGraphEventMode.BYPASS },
        { nodeId: 10, mode: LGraphEventMode.BYPASS }
      ]
    })
  })

  it('applies once and returns a mixed-mode inverse batch', () => {
    const nodes = [
      makeNode(10, LGraphEventMode.ON_TRIGGER),
      makeNode(2, LGraphEventMode.ALWAYS)
    ]
    const graph = makeGraph(nodes)
    const batch = createGroupNodeModeCommandBatch(
      graph.id,
      nodes,
      LGraphEventMode.NEVER
    )
    expect(batch).not.toBeNull()

    const inverse = applyGroupNodeModeCommandBatch(graph, batch!)

    expect(inverse).not.toBeNull()
    expect(nodes.map((node) => node.mode)).toEqual([
      LGraphEventMode.NEVER,
      LGraphEventMode.NEVER
    ])
    expect(beforeChange).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledTimes(1)
    expect(afterChange).toHaveBeenCalledTimes(1)

    const restoredInverse = applyGroupNodeModeCommandBatch(graph, inverse!)
    expect(restoredInverse).toEqual(batch)
    expect(nodes.map((node) => node.mode)).toEqual([
      LGraphEventMode.ON_TRIGGER,
      LGraphEventMode.ALWAYS
    ])
    expect(beforeChange).toHaveBeenCalledTimes(2)
    expect(change).toHaveBeenCalledTimes(2)
    expect(afterChange).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid replay without mutating or opening a transaction', () => {
    const node = makeNode(1, LGraphEventMode.ALWAYS)
    const graph = makeGraph([node])
    const batch = {
      type: 'comfy.groupNodeMode.set' as const,
      version: 1 as const,
      graphId: graph.id,
      entries: [{ nodeId: 999, mode: LGraphEventMode.BYPASS }]
    }

    expect(applyGroupNodeModeCommandBatch(graph, batch)).toBeNull()
    expect(node.mode).toBe(LGraphEventMode.ALWAYS)
    expect(beforeChange).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
    expect(afterChange).not.toHaveBeenCalled()
  })
})
