import { useThrottleFn } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { useMinimapGraph } from '@/renderer/extensions/minimap/composables/useMinimapGraph'
import { api } from '@/scripts/api'
import {
  createMockLGraph,
  createMockLGraphNode,
  createMockLLink,
  createMockLinks
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@vueuse/core', () => ({
  useThrottleFn: vi.fn((fn) => fn)
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn().mockReturnValue({
    nodeProgressStates: {}
  })
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
    vi.clearAllMocks()

    mockGraph = createMockLGraph({
      id: 'test-graph-123',
      _nodes: [
        createMockLGraphNode({ id: '1', pos: [100, 100], size: [150, 80] }),
        createMockLGraphNode({ id: '2', pos: [300, 200], size: [120, 60] })
      ],
      links: createMockLinks([createMockLLink({ id: toLinkId(1) })]),
      onNodeAdded: vi.fn(),
      onNodeRemoved: vi.fn(),
      onConnectionChange: vi.fn()
    })

    onGraphChangedMock = vi.fn()
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

  it('should detect node count changes', () => {
    const graphRef = ref(mockGraph) as Ref<LGraph | null>
    const graphManager = useMinimapGraph(graphRef, onGraphChangedMock)

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
