import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import {
  useSubgraphNavigationStore,
  VIEWPORT_CACHE_MAX_SIZE
} from '@/stores/subgraphNavigationStore'

const { mockSetDirty } = vi.hoisted(() => ({
  mockSetDirty: vi.fn()
}))

vi.mock('@/scripts/app', () => {
  const mockCanvas = {
    subgraph: undefined as unknown,
    graph: undefined as unknown,
    ds: {
      scale: 1,
      offset: [0, 0],
      state: { scale: 1, offset: [0, 0] },
      fitToBounds: vi.fn(),
      visible_area: [0, 0, 1000, 1000],
      computeVisibleArea: vi.fn()
    },
    viewport: [0, 0, 1000, 1000],
    setDirty: mockSetDirty,
    get empty() {
      return true
    }
  }

  const mockGraph = {
    _nodes: [],
    nodes: [],
    subgraphs: new Map(),
    getNodeById: vi.fn(),
    id: 'root'
  }

  mockCanvas.graph = mockGraph

  return {
    app: {
      graph: mockGraph,
      rootGraph: mockGraph,
      canvas: mockCanvas
    }
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => app.canvas
  })
}))
vi.mock('@vueuse/router', () => ({ useRouteHash: vi.fn() }))

const { mockFitView } = vi.hoisted(() => ({
  mockFitView: vi.fn()
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ fitView: mockFitView })
}))

const mockCanvas = app.canvas

let rafCallbacks: FrameRequestCallback[] = []

describe('useSubgraphNavigationStore - Viewport Persistence', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    rafCallbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    mockCanvas.subgraph = undefined
    mockCanvas.graph = app.graph
    mockCanvas.ds.scale = 1
    mockCanvas.ds.offset = [0, 0]
    mockCanvas.ds.state.scale = 1
    mockCanvas.ds.state.offset = [0, 0]
    mockSetDirty.mockClear()
    mockFitView.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('cache key isolation', () => {
    it('isolates viewport by workflow — same graphId returns different values', () => {
      const store = useSubgraphNavigationStore()
      const workflowStore = useWorkflowStore()

      // Save viewport under workflow A
      workflowStore.activeWorkflow = {
        path: 'wfA.json'
      } as typeof workflowStore.activeWorkflow
      mockCanvas.ds.state.scale = 2
      mockCanvas.ds.state.offset = [10, 20]
      store.saveViewport('root')

      // Save different viewport under workflow B
      workflowStore.activeWorkflow = {
        path: 'wfB.json'
      } as typeof workflowStore.activeWorkflow
      mockCanvas.ds.state.scale = 5
      mockCanvas.ds.state.offset = [99, 88]
      store.saveViewport('root')

      // Restore under A — should get A's values
      workflowStore.activeWorkflow = {
        path: 'wfA.json'
      } as typeof workflowStore.activeWorkflow
      store.restoreViewport('root')

      expect(mockCanvas.ds.scale).toBe(2)
      expect(mockCanvas.ds.offset).toEqual([10, 20])
    })
  })

  describe('saveViewport', () => {
    it('saves viewport state for root graph', () => {
      const store = useSubgraphNavigationStore()
      mockCanvas.ds.state.scale = 2
      mockCanvas.ds.state.offset = [100, 200]

      store.saveViewport('root')

      expect(store.viewportCache.get(':root')).toEqual({
        scale: 2,
        offset: [100, 200]
      })
    })

    it('saves viewport state for subgraph', () => {
      const store = useSubgraphNavigationStore()
      mockCanvas.ds.state.scale = 1.5
      mockCanvas.ds.state.offset = [50, 75]

      store.saveViewport('subgraph-123')

      expect(store.viewportCache.get(':subgraph-123')).toEqual({
        scale: 1.5,
        offset: [50, 75]
      })
    })
  })

  describe('restoreViewport', () => {
    it('restores cached viewport', () => {
      const store = useSubgraphNavigationStore()
      store.viewportCache.set(':root', { scale: 2.5, offset: [150, 250] })

      store.restoreViewport('root')

      expect(mockCanvas.ds.scale).toBe(2.5)
      expect(mockCanvas.ds.offset).toEqual([150, 250])
      expect(mockSetDirty).toHaveBeenCalledWith(true, true)
    })

    it('does not mutate canvas synchronously on cache miss', () => {
      const store = useSubgraphNavigationStore()
      mockCanvas.ds.scale = 1
      mockCanvas.ds.offset = [0, 0]
      mockSetDirty.mockClear()

      store.restoreViewport('non-existent')

      // Should not change canvas synchronously
      expect(mockCanvas.ds.scale).toBe(1)
      expect(mockCanvas.ds.offset).toEqual([0, 0])
      expect(mockSetDirty).not.toHaveBeenCalled()
      // But should have scheduled a rAF
      expect(rafCallbacks).toHaveLength(1)
    })

    it('calls fitView on cache miss after rAF fires', () => {
      const store = useSubgraphNavigationStore()
      // Ensure no cached entry
      store.viewportCache.delete(':root')

      // Add a node outside the visible area so anyItemOverlapsRect returns false
      const mockGraph = app.graph as { nodes: unknown[]; _nodes: unknown[] }
      mockGraph.nodes = [{ pos: [9999, 9999], size: [100, 100] }]
      mockGraph._nodes = mockGraph.nodes

      // Use the root graph ID so the stale-guard passes
      store.restoreViewport('root')

      expect(mockFitView).not.toHaveBeenCalled()
      expect(rafCallbacks).toHaveLength(1)

      // Simulate rAF firing — active graph still matches
      rafCallbacks[0](performance.now())

      expect(mockFitView).toHaveBeenCalledOnce()

      // Cleanup
      mockGraph.nodes = []
      mockGraph._nodes = []
    })

    it('skips fitView if active graph changed before rAF fires', () => {
      const store = useSubgraphNavigationStore()
      store.viewportCache.delete(':root')

      store.restoreViewport('root')
      expect(rafCallbacks).toHaveLength(1)

      // Simulate graph switching away before rAF fires
      mockCanvas.subgraph = { id: 'different-graph' } as never

      rafCallbacks[0](performance.now())

      expect(mockFitView).not.toHaveBeenCalled()
    })
  })

  describe('navigation integration', () => {
    it('saves and restores viewport when navigating between subgraphs', async () => {
      const store = useSubgraphNavigationStore()
      const workflowStore = useWorkflowStore()

      const mockRootGraph = {
        _nodes: [],
        nodes: [],
        subgraphs: new Map(),
        getNodeById: vi.fn()
      } as Partial<LGraph> as LGraph
      const subgraph1 = {
        id: 'sub1',
        rootGraph: mockRootGraph,
        _nodes: [],
        nodes: []
      }

      mockCanvas.ds.state.scale = 2
      mockCanvas.ds.state.offset = [100, 100]

      // Enter subgraph
      workflowStore.activeSubgraph = subgraph1 as Partial<Subgraph> as Subgraph
      await nextTick()

      // Root viewport saved
      expect(store.viewportCache.get(':root')).toEqual({
        scale: 2,
        offset: [100, 100]
      })

      // Change viewport in subgraph
      mockCanvas.ds.state.scale = 0.5
      mockCanvas.ds.state.offset = [-50, -50]

      // Exit subgraph
      workflowStore.activeSubgraph = undefined
      await nextTick()

      // Subgraph viewport saved
      expect(store.viewportCache.get(':sub1')).toEqual({
        scale: 0.5,
        offset: [-50, -50]
      })

      // Root viewport restored
      expect(mockCanvas.ds.scale).toBe(2)
      expect(mockCanvas.ds.offset).toEqual([100, 100])
    })

    it('preserves pre-existing cache entries across workflow switches', async () => {
      const store = useSubgraphNavigationStore()
      const workflowStore = useWorkflowStore()

      store.viewportCache.set(':root', { scale: 2, offset: [0, 0] })
      store.viewportCache.set(':sub1', { scale: 1.5, offset: [10, 10] })
      expect(store.viewportCache.size).toBe(2)

      const wf1 = { path: 'wf1.json' } as ComfyWorkflow
      const wf2 = { path: 'wf2.json' } as ComfyWorkflow

      workflowStore.activeWorkflow = wf1 as typeof workflowStore.activeWorkflow
      await nextTick()

      workflowStore.activeWorkflow = wf2 as typeof workflowStore.activeWorkflow
      await nextTick()

      // Pre-existing entries still in cache
      expect(store.viewportCache.has(':root')).toBe(true)
      expect(store.viewportCache.has(':sub1')).toBe(true)
    })

    it('should save/restore viewports correctly across multiple subgraphs', () => {
      const navigationStore = useSubgraphNavigationStore()

      navigationStore.viewportCache.set(':root', {
        scale: 1,
        offset: [0, 0]
      })
      navigationStore.viewportCache.set(':sub-1', {
        scale: 2,
        offset: [100, 200]
      })
      navigationStore.viewportCache.set(':sub-2', {
        scale: 0.5,
        offset: [-50, -75]
      })

      navigationStore.restoreViewport('sub-1')
      expect(mockCanvas.ds.scale).toBe(2)
      expect(mockCanvas.ds.offset).toEqual([100, 200])

      navigationStore.restoreViewport('sub-2')
      expect(mockCanvas.ds.scale).toBe(0.5)
      expect(mockCanvas.ds.offset).toEqual([-50, -75])

      navigationStore.restoreViewport('root')
      expect(mockCanvas.ds.scale).toBe(1)
      expect(mockCanvas.ds.offset).toEqual([0, 0])
    })

    it('should evict oldest viewport entry when LRU cache exceeds capacity', () => {
      const navigationStore = useSubgraphNavigationStore()
      const overflowEntryCount = VIEWPORT_CACHE_MAX_SIZE * 2 + 1

      // QuickLRU uses double-buffering: effective capacity is up to 2 * maxSize.
      // Fill enough entries so the earliest ones are fully evicted.
      // Keys use the workflow-scoped format (`:graphId`) matching production.
      for (let i = 0; i < overflowEntryCount; i++) {
        navigationStore.viewportCache.set(`:sub-${i}`, {
          scale: i + 1,
          offset: [i * 10, i * 20]
        })
      }

      expect(navigationStore.viewportCache.has(':sub-0')).toBe(false)

      expect(
        navigationStore.viewportCache.has(`:sub-${overflowEntryCount - 1}`)
      ).toBe(true)

      mockCanvas.ds.scale = 99
      mockCanvas.ds.offset = [999, 999]
      mockSetDirty.mockClear()

      navigationStore.restoreViewport('sub-0')

      expect(mockCanvas.ds.scale).toBe(99)
      expect(mockCanvas.ds.offset).toEqual([999, 999])
      expect(mockSetDirty).not.toHaveBeenCalled()
    })
  })
})
