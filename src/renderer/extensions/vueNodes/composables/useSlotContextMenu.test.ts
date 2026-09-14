import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'

const { mockGraph, mockCanvas } = vi.hoisted(() => {
  const mockGraph = {
    _nodes: [] as any[],
    getNodeById: vi.fn(),
    beforeChange: vi.fn(),
    afterChange: vi.fn()
  }
  const mockCanvas = {
    graph: mockGraph as any,
    setDirty: vi.fn()
  }
  return { mockGraph, mockCanvas }
})

vi.mock('@/scripts/app', () => ({
  app: { canvas: mockCanvas }
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: {
    isValidConnection: vi.fn((a: unknown, b: unknown) => a === b)
  }
}))

import { connectSlots, findCompatibleTargets } from './useSlotContextMenu'

function createMockNode(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? '1',
    pos: overrides.pos ?? [0, 0],
    title: overrides.title ?? 'TestNode',
    type: overrides.type ?? 'TestType',
    mode: overrides.mode ?? LGraphEventMode.ALWAYS,
    inputs: overrides.inputs ?? [],
    outputs: overrides.outputs ?? [],
    connect: vi.fn(),
    ...overrides
  } as unknown as LGraphNode & { connect: ReturnType<typeof vi.fn> }
}

describe('findCompatibleTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGraph._nodes = []
    mockCanvas.graph = mockGraph
  })

  it('returns empty array when graph is null', () => {
    mockCanvas.graph = null as any
    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })

  it('returns empty array when source node is not found', () => {
    mockGraph.getNodeById.mockReturnValue(null)
    const result = findCompatibleTargets({
      nodeId: '99',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })

  it('returns empty array when source slot has wildcard type "*"', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: '*', link: null }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })

  it('returns empty array when source slot has wildcard type ""', () => {
    const source = createMockNode({
      id: '1',
      outputs: [{ type: '', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: false
    })
    expect(result).toEqual([])
  })

  it('returns empty array when source slot has wildcard type 0', () => {
    const source = createMockNode({
      id: '1',
      outputs: [{ type: 0, links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: false
    })
    expect(result).toEqual([])
  })

  it('finds compatible output nodes when source is input', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const candidate = createMockNode({
      id: '2',
      outputs: [{ type: 'IMAGE', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, candidate]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toHaveLength(1)
    expect(result[0].node).toBe(candidate)
    expect(result[0].slotIndex).toBe(0)
  })

  it('finds compatible input nodes when source is output', () => {
    const source = createMockNode({
      id: '1',
      outputs: [{ type: 'MODEL', links: [] }]
    })
    const candidate = createMockNode({
      id: '2',
      inputs: [{ type: 'MODEL', link: null }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, candidate]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: false
    })
    expect(result).toHaveLength(1)
    expect(result[0].node).toBe(candidate)
    expect(result[0].slotIndex).toBe(0)
  })

  it('skips bypassed nodes', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const bypassed = createMockNode({
      id: '2',
      mode: LGraphEventMode.NEVER,
      outputs: [{ type: 'IMAGE', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, bypassed]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })

  it('skips already-connected inputs', () => {
    const source = createMockNode({
      id: '1',
      outputs: [{ type: 'MODEL', links: [] }]
    })
    const connected = createMockNode({
      id: '2',
      inputs: [{ type: 'MODEL', link: 42 }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, connected]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: false
    })
    expect(result).toEqual([])
  })

  it('skips wildcard-typed candidate slots', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const wildcardCandidate = createMockNode({
      id: '2',
      outputs: [{ type: '*', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, wildcardCandidate]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })

  it('sorts results by node Y position', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const nodeHigh = createMockNode({
      id: '2',
      pos: [0, 300],
      outputs: [{ type: 'IMAGE', links: [] }]
    })
    const nodeLow = createMockNode({
      id: '3',
      pos: [0, 100],
      outputs: [{ type: 'IMAGE', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, nodeHigh, nodeLow]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toHaveLength(2)
    expect(result[0].node).toBe(nodeLow)
    expect(result[1].node).toBe(nodeHigh)
  })

  it('limits results to maxResults', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const candidates = Array.from({ length: 5 }, (_, i) =>
      createMockNode({
        id: String(i + 2),
        pos: [0, i * 100],
        outputs: [{ type: 'IMAGE', links: [] }]
      })
    )
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source, ...candidates]

    const result = findCompatibleTargets(
      { nodeId: '1', slotIndex: 0, isInput: true },
      3
    )
    expect(result).toHaveLength(3)
  })

  it('does not include the source node itself', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }],
      outputs: [{ type: 'IMAGE', links: [] }]
    })
    mockGraph.getNodeById.mockReturnValue(source)
    mockGraph._nodes = [source]

    const result = findCompatibleTargets({
      nodeId: '1',
      slotIndex: 0,
      isInput: true
    })
    expect(result).toEqual([])
  })
})

describe('connectSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('calls graph.beforeChange and afterChange', () => {
    const source = createMockNode({ id: '1', outputs: [{ type: 'MODEL' }] })
    const target = createMockNode({
      id: '2',
      inputs: [{ type: 'MODEL', link: null }]
    })
    mockGraph.getNodeById.mockReturnValue(source)

    connectSlots(
      { nodeId: '1', slotIndex: 0, isInput: false },
      { node: target, slotIndex: 0, slotInfo: target.inputs[0] }
    )

    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(mockGraph.afterChange).toHaveBeenCalled()
  })

  it('connects source output to target input', () => {
    const source = createMockNode({ id: '1', outputs: [{ type: 'MODEL' }] })
    const target = createMockNode({
      id: '2',
      inputs: [{ type: 'MODEL', link: null }]
    })
    mockGraph.getNodeById.mockReturnValue(source)

    connectSlots(
      { nodeId: '1', slotIndex: 0, isInput: false },
      { node: target, slotIndex: 0, slotInfo: target.inputs[0] }
    )

    expect(source.connect).toHaveBeenCalledWith(0, target, 0)
  })

  it('connects target output to source input when source is input', () => {
    const source = createMockNode({
      id: '1',
      inputs: [{ type: 'IMAGE', link: null }]
    })
    const target = createMockNode({ id: '2', outputs: [{ type: 'IMAGE' }] })
    mockGraph.getNodeById.mockReturnValue(source)

    connectSlots(
      { nodeId: '1', slotIndex: 0, isInput: true },
      { node: target, slotIndex: 0, slotInfo: target.outputs[0] }
    )

    expect(target.connect).toHaveBeenCalledWith(0, source, 0)
  })

  it('does nothing when graph is null', () => {
    mockCanvas.graph = null as any
    const target = createMockNode({ id: '2' })

    connectSlots(
      { nodeId: '1', slotIndex: 0, isInput: false },
      { node: target, slotIndex: 0, slotInfo: {} as any }
    )

    expect(target.connect).not.toHaveBeenCalled()
  })

  it('marks canvas as dirty after connecting', () => {
    const source = createMockNode({ id: '1', outputs: [{ type: 'MODEL' }] })
    const target = createMockNode({
      id: '2',
      inputs: [{ type: 'MODEL', link: null }]
    })
    mockGraph.getNodeById.mockReturnValue(source)

    connectSlots(
      { nodeId: '1', slotIndex: 0, isInput: false },
      { node: target, slotIndex: 0, slotInfo: target.inputs[0] }
    )

    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })
})
