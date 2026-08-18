import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { useMinimapGraph } from '@/renderer/extensions/minimap/composables/useMinimapGraph'
import {
  createMockLGraph,
  createMockLGraphNode,
  createMockLLink,
  createMockLinks
} from '@/utils/__tests__/litegraphTestUtils'

const { mockProgressStates } = vi.hoisted(() => ({
  mockProgressStates: {} as Record<string, { state: string }>
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({
    nodeProgressStates: mockProgressStates
  }))
}))

describe('useMinimapGraph', () => {
  let mockGraph: LGraph

  beforeEach(() => {
    mockGraph = createMockLGraph({
      id: 'test-graph-123',
      _nodes: [
        createMockLGraphNode({ id: '1', pos: [100, 100], size: [150, 80] }),
        createMockLGraphNode({ id: '2', pos: [300, 200], size: [120, 60] })
      ],
      links: createMockLinks([createMockLLink({ id: toLinkId(1) })])
    })

    for (const key of Object.keys(mockProgressStates)) {
      delete mockProgressStates[key]
    }
  })

  function createChangeDetector(graph: LGraph | null = mockGraph) {
    return useMinimapGraph(shallowRef<LGraph | null>(graph))
  }

  it('should detect node position changes', () => {
    const graphManager = createChangeDetector()

    // First check - cache initial state
    let hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true) // Initial cache population

    // No changes
    hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(false)

    // Change node position
    mockGraph._nodes[0].pos = [200, 150]
    hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
    expect(graphManager.updateFlags.value.nodes).toBe(true)
  })

  it('should detect node count changes', () => {
    const graphManager = createChangeDetector()

    // Cache initial state
    graphManager.checkForChanges()

    // Add a node
    mockGraph._nodes.push({
      id: '3',
      pos: [400, 300],
      size: [100, 50]
    } as Partial<LGraphNode> as LGraphNode)

    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
    expect(graphManager.updateFlags.value.nodes).toBe(true)
  })

  it('should detect connection changes', () => {
    const graphManager = createChangeDetector()

    // Cache initial state
    graphManager.checkForChanges()

    // Change connections
    mockGraph.links = createMockLinks([
      createMockLLink({ id: toLinkId(1) }),
      createMockLLink({ id: toLinkId(2) })
    ])

    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.connections).toBe(true)
  })

  it('should detect a rewire that leaves the link count unchanged', () => {
    mockGraph.links = createMockLinks([
      createMockLLink({
        id: toLinkId(1),
        origin_id: toNodeId(1),
        target_id: toNodeId(2)
      })
    ])

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Same number of links, different endpoints.
    mockGraph.links = createMockLinks([
      createMockLLink({
        id: toLinkId(1),
        origin_id: toNodeId(1),
        target_id: toNodeId(3)
      })
    ])

    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.updateFlags.value.connections).toBe(true)
  })

  it('detects a rewire between nonnumeric node IDs', () => {
    mockGraph.links = createMockLinks([
      createMockLLink({
        id: toLinkId(1),
        origin_id: toNodeId('source'),
        target_id: toNodeId('target-a')
      })
    ])

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph.links = createMockLinks([
      createMockLLink({
        id: toLinkId(1),
        origin_id: toNodeId('source'),
        target_id: toNodeId('target-b')
      })
    ])

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('keeps reporting no change while the graph is untouched', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()

    for (let poll = 0; poll < 10; poll++) {
      expect(graphManager.checkForChanges()).toBe(false)
    }
  })

  it('is not blinded by a non-finite value elsewhere in the graph', () => {
    // A NaN coordinate must contribute zero on its own term rather than
    // resetting the accumulator, which would hide every other node's movement.
    mockGraph._nodes.push(
      createMockLGraphNode({ id: '3', pos: [Number.NaN, 0], size: [10, 10] })
    )

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].pos = [100, 0]

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('detects a store-side geometry change with the litegraph nodes untouched', () => {
    useLayoutMutations().createNode(toNodeId('1'), {
      position: { x: 100, y: 100 },
      size: { width: 150, height: 80 }
    })

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // The renderer draws from layoutStore, so a move that reached the store but
    // whose write-back to the litegraph node has not landed must still count.
    useLayoutMutations().moveNode(toNodeId('1'), { x: 500, y: 500 })

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('ignores a z-index change, which the minimap never draws', () => {
    useLayoutMutations().createNode(toNodeId('2'), {
      position: { x: 300, y: 200 },
      size: { width: 120, height: 60 }
    })

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Fires on every widget pointerdown; redrawing for it would rebuild the
    // whole layout map for a picture that cannot have changed.
    useLayoutMutations().setNodeZIndex(toNodeId('2'), 42)

    expect(graphManager.checkForChanges()).toBe(false)
  })

  it('should detect a background colour change', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].bgcolor = '#ff0000'

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a group move', () => {
    mockGraph._groups = [
      { pos: [0, 0], size: [400, 300], color: '#111111' }
    ] as LGraph['_groups']

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._groups[0].pos[0] = 250

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect an execution-state transition', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockProgressStates['1'] = { state: 'running' }
    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.checkForChanges()).toBe(false)

    mockProgressStates['1'] = { state: 'finished' }
    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('a visual-only change repaints without recomputing bounds', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    graphManager.updateFlags.value.bounds = false
    graphManager.updateFlags.value.nodes = false

    mockGraph._nodes[0].bgcolor = '#00ff00'
    graphManager.checkForChanges()

    expect(graphManager.updateFlags.value.nodes).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(false)
  })

  it('should detect an error-state change', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].has_errors = true

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a mode change', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].mode = 4

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a fractional-only position change', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].pos = [100.5, 100]

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a rewire that only changes the slot', () => {
    mockGraph.links = createMockLinks([
      createMockLLink({ id: toLinkId(1), origin_slot: 0, target_slot: 0 })
    ])

    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Same nodes on both ends, different slot.
    mockGraph.links = createMockLinks([
      createMockLLink({ id: toLinkId(1), origin_slot: 0, target_slot: 1 })
    ])

    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.updateFlags.value.connections).toBe(true)
  })

  it('detects the current graph again after reset', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    graphManager.reset()

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('reports no changes without a graph', () => {
    const graphManager = createChangeDetector(null)

    expect(graphManager.checkForChanges()).toBe(false)
  })

  it('detects node removal', () => {
    const graphManager = createChangeDetector()

    graphManager.checkForChanges()
    mockGraph._nodes = mockGraph._nodes.filter((n) => n.id !== '2')

    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
  })
})
