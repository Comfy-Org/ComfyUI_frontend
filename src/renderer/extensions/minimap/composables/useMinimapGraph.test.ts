import { useThrottleFn } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useMinimapGraph } from '@/renderer/extensions/minimap/composables/useMinimapGraph'
import { api } from '@/scripts/api'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import {
  createMockLGraph,
  createMockLGraphNode,
  createMockLLink,
  createMockLinks
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@vueuse/core', () => ({
  useThrottleFn: vi.fn((fn) => fn)
}))

const { mockProgressStates } = vi.hoisted(() => ({
  mockProgressStates: {} as Record<string, { state: string }>
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({
    nodeProgressStates: mockProgressStates
  }))
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe('useMinimapGraph', () => {
  let mockGraph: LGraph
  let onGraphChangedMock: () => void

  beforeEach(() => {
    layoutStore.resetForTests()
    mockGraph = createMockLGraph({
      id: 'test-graph-123',
      _nodes: [
        createMockLGraphNode({ id: '1', pos: [100, 100], size: [150, 80] }),
        createMockLGraphNode({ id: '2', pos: [300, 200], size: [120, 60] })
      ],
      links: createMockLinks([createMockLLink({ id: toLinkId(1) })]),
      events: new CustomEventTarget<LGraphEventMap>(),
      onNodeAdded: vi.fn(),
      onNodeRemoved: vi.fn(),
      onConnectionChange: vi.fn()
    })

    onGraphChangedMock = vi.fn()
    for (const key of Object.keys(mockProgressStates)) {
      delete mockProgressStates[key]
    }
  })

  it('should initialize with empty state', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    expect(graphManager.updateFlags.value).toEqual({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
  })

  it('should setup event listeners on init', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.init()

    expect(api.addEventListener).toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )
  })

  it('notifies on node add without displacing the graph callback', () => {
    const originalOnNodeAdded = vi.fn()
    mockGraph.onNodeAdded = originalOnNodeAdded

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()

    // The callback slot is left alone; the minimap subscribes to the event.
    expect(mockGraph.onNodeAdded).toBe(originalOnNodeAdded)

    mockGraph.events.dispatch('node:added', { node: { id: '3' } as LGraphNode })

    expect(onGraphChangedMock).toHaveBeenCalled()
  })

  it('notifies on connection change after running the original callback', () => {
    const originalOnConnectionChange = vi.fn()
    mockGraph.onConnectionChange = originalOnConnectionChange

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()
    mockGraph.onConnectionChange?.(mockGraph._nodes[0])

    expect(originalOnConnectionChange).toHaveBeenCalledWith(mockGraph._nodes[0])
    expect(onGraphChangedMock).toHaveBeenCalledTimes(1)
  })

  it('should prevent duplicate event listener setup', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()
    graphManager.setupEventListeners()

    mockGraph.events.dispatch('node:added', { node: { id: '3' } as LGraphNode })

    expect(onGraphChangedMock).toHaveBeenCalledTimes(1)
  })

  it('should cleanup event listeners properly', () => {
    const originalOnConnectionChange = vi.fn()
    mockGraph.onConnectionChange = originalOnConnectionChange

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()
    graphManager.cleanupEventListeners()

    expect(mockGraph.onConnectionChange).toBe(originalOnConnectionChange)

    mockGraph.events.dispatch('node:added', { node: { id: '3' } as LGraphNode })

    expect(onGraphChangedMock).not.toHaveBeenCalled()
  })

  it('should handle cleanup for never-setup graph', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    expect(() => graphManager.cleanupEventListeners()).not.toThrow()
  })

  it('cleanup leaves a later wrapper alone when one is layered on top', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()
    const minimapWrapper = mockGraph.onConnectionChange

    // Simulate another system adding its own wrapper on top
    const downstream = vi.fn()
    const layeredWrapper = vi.fn(function (this: unknown, node: LGraphNode) {
      minimapWrapper?.call(this, node)
      downstream(node)
    })
    mockGraph.onConnectionChange = layeredWrapper

    graphManager.cleanupEventListeners()

    // The newer wrapper must survive cleanup
    expect(mockGraph.onConnectionChange).toBe(layeredWrapper)
  })

  it('a buried wrapper becomes inert after cleanup', () => {
    const originalOnConnectionChange = vi.fn()
    mockGraph.onConnectionChange = originalOnConnectionChange

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()
    const buriedWrapper = mockGraph.onConnectionChange

    // Layer something on top so cleanup can't restore.
    mockGraph.onConnectionChange = vi.fn()
    graphManager.cleanupEventListeners()
    vi.mocked(onGraphChangedMock).mockClear()

    // Call the method directly and ensure it is a no-op
    const testNode = { id: '9' } as LGraphNode
    buriedWrapper(testNode)

    expect(originalOnConnectionChange).toHaveBeenCalledWith(testNode)
    expect(onGraphChangedMock).not.toHaveBeenCalled()
  })

  it('invalidates cache and fires update on visual property changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)
    graphManager.setupEventListeners()

    mockGraph.events.dispatch('node:property:changed', {
      nodeId: '1',
      property: 'color',
      oldValue: '',
      newValue: '#fff'
    })

    expect(onGraphChangedMock).toHaveBeenCalled()
  })

  it('ignores unrelated property changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)
    graphManager.setupEventListeners()

    mockGraph.events.dispatch('node:property:changed', {
      nodeId: '1',
      property: 'title',
      oldValue: 'a',
      newValue: 'b'
    })

    expect(onGraphChangedMock).not.toHaveBeenCalled()
  })

  it('detaches the property listener on cleanup', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)
    graphManager.setupEventListeners()
    graphManager.cleanupEventListeners()

    mockGraph.events.dispatch('node:property:changed', {
      nodeId: '1',
      property: 'mode',
      oldValue: 0,
      newValue: 1
    })

    expect(onGraphChangedMock).not.toHaveBeenCalled()
  })

  it('should detect node position changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

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

  it('detects a rendered size change without a requested size change', () => {
    const node = mockGraph._nodes[0]
    let renderedSize = node.size
    Object.defineProperty(node, 'renderingSize', {
      get: () => renderedSize
    })
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    renderedSize = [240, 180]

    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
    expect(graphManager.updateFlags.value.nodes).toBe(true)
  })

  it('recomputes bounds after a reload that leaves node geometry identical', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)
    graphManager.setupEventListeners()

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Reloading the same workflow leaves the node count and every geometry
    // string unchanged, so only `configured` can say the bounds are stale.
    mockGraph.events.dispatch('configured')

    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
  })

  it('should detect node count changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    // Cache initial state
    graphManager.checkForChanges()

    // Add a node
    mockGraph._nodes.push(
      createMockLGraphNode({ id: '3', pos: [400, 300], size: [100, 50] })
    )

    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
    expect(graphManager.updateFlags.value.nodes).toBe(true)
  })

  it('should detect connection changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

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

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

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

  it('keeps reporting no change while the graph is untouched', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

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

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].pos = [100, 0]

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('detects a store-side geometry change with the litegraph nodes untouched', () => {
    const nodeId = toNodeId('1')
    const graphId = mockGraph.rootGraph.id
    layoutStore.applyOperation({
      type: 'createNode',
      graphId,
      nodeId,
      layout: {
        id: nodeId,
        position: { x: 100, y: 100 },
        size: { width: 150, height: 80 },
        bounds: { x: 100, y: 100, width: 150, height: 80 },
        zIndex: 0,
        visible: true
      },
      timestamp: Date.now(),
      source: LayoutSource.Vue
    })

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // The renderer draws from layoutStore, so a move that reached the store but
    // whose write-back to the litegraph node has not landed must still count.
    useLayoutMutations(LayoutSource.Vue).moveNode(graphId, nodeId, {
      x: 500,
      y: 500
    })

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('ignores a z-index change, which the minimap never draws', () => {
    const nodeId = toNodeId('2')
    const graphId = mockGraph.rootGraph.id
    layoutStore.applyOperation({
      type: 'createNode',
      graphId,
      nodeId,
      layout: {
        id: nodeId,
        position: { x: 300, y: 200 },
        size: { width: 120, height: 60 },
        bounds: { x: 300, y: 200, width: 120, height: 60 },
        zIndex: 0,
        visible: true
      },
      timestamp: Date.now(),
      source: LayoutSource.Vue
    })

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Fires on every widget pointerdown; redrawing for it would rebuild the
    // whole layout map for a picture that cannot have changed.
    useLayoutMutations(LayoutSource.Vue).setNodeZIndex(graphId, nodeId, 42)

    expect(graphManager.checkForChanges()).toBe(false)
  })

  it('should detect a background colour change', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].bgcolor = '#ff0000'

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a group move', () => {
    mockGraph._groups = [
      { pos: [0, 0], size: [400, 300], color: '#111111' }
    ] as LGraph['_groups']

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._groups[0].pos[0] = 250

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect an execution-state transition', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockProgressStates['1'] = { state: 'running' }
    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.checkForChanges()).toBe(false)

    mockProgressStates['1'] = { state: 'finished' }
    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('a visual-only change repaints without recomputing bounds', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    graphManager.updateFlags.value.bounds = false
    graphManager.updateFlags.value.nodes = false

    mockGraph._nodes[0].bgcolor = '#00ff00'
    graphManager.checkForChanges()

    expect(graphManager.updateFlags.value.nodes).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(false)
  })

  it('should detect an error-state change', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].has_errors = true

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a mode change', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].mode = 4

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a fractional-only position change', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    mockGraph._nodes[0].pos = [100.5, 100]

    expect(graphManager.checkForChanges()).toBe(true)
  })

  it('should detect a rewire that only changes the slot', () => {
    mockGraph.links = createMockLinks([
      createMockLLink({ id: toLinkId(1), origin_slot: 0, target_slot: 0 })
    ])

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.checkForChanges()
    expect(graphManager.checkForChanges()).toBe(false)

    // Same nodes on both ends, different slot.
    mockGraph.links = createMockLinks([
      createMockLLink({ id: toLinkId(1), origin_slot: 0, target_slot: 1 })
    ])

    expect(graphManager.checkForChanges()).toBe(true)
    expect(graphManager.updateFlags.value.connections).toBe(true)
  })

  it('should handle node removal', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()

    mockGraph.events.dispatch('node:removed', {
      node: { id: '2' } as LGraphNode
    })

    expect(onGraphChangedMock).toHaveBeenCalled()
  })

  it('should destroy properly', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.init()
    graphManager.setupEventListeners()
    graphManager.destroy()

    expect(api.removeEventListener).toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )
  })

  it('should clear cache', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    // Populate cache
    graphManager.checkForChanges()

    // Clear cache
    graphManager.clearCache()

    // Should detect changes again after clear
    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
  })

  it('should handle null graph gracefully', () => {
    const graphRef = ref(null) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    expect(() => graphManager.setupEventListeners()).not.toThrow()
    expect(() => graphManager.cleanupEventListeners()).not.toThrow()
    expect(graphManager.checkForChanges()).toBe(false)
  })

  it('should clean up removed nodes from cache', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    // Cache initial state
    graphManager.checkForChanges()

    // Remove a node
    mockGraph._nodes = mockGraph._nodes.filter((n) => n.id !== '2')

    const hasChanges = graphManager.checkForChanges()
    expect(hasChanges).toBe(true)
    expect(graphManager.updateFlags.value.bounds).toBe(true)
  })

  it('should throttle graph changed callback', () => {
    const throttledFn = vi.fn()
    vi.mocked(useThrottleFn).mockReturnValue(throttledFn)

    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

    graphManager.setupEventListeners()

    // Trigger multiple changes rapidly
    for (const id of ['3', '4', '5']) {
      mockGraph.events.dispatch('node:added', { node: { id } as LGraphNode })
    }

    // Should be throttled
    expect(throttledFn).toHaveBeenCalledTimes(3)
  })
})
