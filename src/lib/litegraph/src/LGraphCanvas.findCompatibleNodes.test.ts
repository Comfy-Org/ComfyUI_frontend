import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphEventMode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraphNode,
  createMockNodeInputSlot,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'

type CompatibleResult = Array<{
  node: LGraphNode
  slotIndex: number
  slotInfo: INodeInputSlot | INodeOutputSlot
}>

const findCompatibleNodes = LGraphCanvas.prototype[
  'findCompatibleNodes' as keyof LGraphCanvas
] as (
  sourceNode: LGraphNode,
  sourceSlot: INodeInputSlot | INodeOutputSlot,
  sourceIsInput: boolean,
  maxResults?: number
) => CompatibleResult

function createCanvasContext(nodes: LGraphNode[]) {
  return { graph: { _nodes: nodes } }
}

describe('LGraphCanvas.findCompatibleNodes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(LiteGraph, 'isValidConnection').mockImplementation(
      (a: unknown, b: unknown) => a === b
    )
  })

  it('returns compatible input nodes for an output slot', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const candidate = createMockLGraphNode({
      id: 2,
      pos: [0, 100],
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(1)
    expect(results[0].node).toBe(candidate)
    expect(results[0].slotIndex).toBe(0)
  })

  it('returns compatible output nodes for an input slot', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeInputSlot({ type: 'INT' })

    const candidate = createMockLGraphNode({
      id: 2,
      pos: [0, 50],
      outputs: [createMockNodeOutputSlot({ type: 'INT' })]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, true)

    expect(results).toHaveLength(1)
    expect(results[0].node).toBe(candidate)
    expect(results[0].slotIndex).toBe(0)
  })

  it('skips self-node', () => {
    const sourceNode = createMockLGraphNode({
      id: 1,
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const ctx = createCanvasContext([sourceNode])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('skips bypassed nodes (mode === NEVER)', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const bypassed = createMockLGraphNode({
      id: 2,
      mode: LGraphEventMode.NEVER,
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })

    const ctx = createCanvasContext([sourceNode, bypassed])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('returns empty for wildcard source slot type "*"', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: '*' })

    const candidate = createMockLGraphNode({
      id: 2,
      inputs: [createMockNodeInputSlot({ type: '*', link: null })]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('returns empty for wildcard source slot type ""', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: '' })

    const ctx = createCanvasContext([sourceNode])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('returns empty for wildcard source slot type 0', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 0 })

    const ctx = createCanvasContext([sourceNode])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('skips candidate slots with wildcard type', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const candidate = createMockLGraphNode({
      id: 2,
      pos: [0, 0],
      inputs: [
        createMockNodeInputSlot({ type: '*', link: null }),
        createMockNodeInputSlot({ type: '', link: null }),
        createMockNodeInputSlot({ type: 0 as unknown as string, link: null })
      ]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('skips already-connected inputs', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const candidate = createMockLGraphNode({
      id: 2,
      pos: [0, 0],
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: 42 })]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('sorts results by Y position', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const nodeA = createMockLGraphNode({
      id: 2,
      pos: [0, 300],
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })
    const nodeB = createMockLGraphNode({
      id: 3,
      pos: [0, 100],
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })
    const nodeC = createMockLGraphNode({
      id: 4,
      pos: [0, 200],
      inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
    })

    const ctx = createCanvasContext([sourceNode, nodeA, nodeB, nodeC])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(3)
    expect(results[0].node).toBe(nodeB)
    expect(results[1].node).toBe(nodeC)
    expect(results[2].node).toBe(nodeA)
  })

  it('limits results to maxResults', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const candidates = Array.from({ length: 5 }, (_, i) =>
      createMockLGraphNode({
        id: i + 2,
        pos: [0, i * 100],
        inputs: [createMockNodeInputSlot({ type: 'FLOAT', link: null })]
      })
    )

    const ctx = createCanvasContext([sourceNode, ...candidates])
    const results = findCompatibleNodes.call(
      ctx,
      sourceNode,
      sourceSlot,
      false,
      3
    )

    expect(results).toHaveLength(3)
  })

  it('returns empty when no nodes match', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const candidate = createMockLGraphNode({
      id: 2,
      pos: [0, 0],
      inputs: [createMockNodeInputSlot({ type: 'STRING', link: null })]
    })

    const ctx = createCanvasContext([sourceNode, candidate])
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })

  it('returns empty when graph is null', () => {
    const sourceNode = createMockLGraphNode({ id: 1 })
    const sourceSlot = createMockNodeOutputSlot({ type: 'FLOAT' })

    const ctx = { graph: null }
    const results = findCompatibleNodes.call(ctx, sourceNode, sourceSlot, false)

    expect(results).toHaveLength(0)
  })
})
