import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const mockNodeOutputStore = vi.hoisted(() => ({
  snapshotOutputs: vi.fn(() => ({})),
  restoreOutputs: vi.fn()
}))

const mockSubgraphNavigationStore = vi.hoisted(() => ({
  exportState: vi.fn(() => []),
  restoreState: vi.fn()
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: null as { changeTracker: unknown } | null,
  getWorkflowByPath: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {},
    rootGraph: {
      serialize: vi.fn(() => ({
        nodes: [],
        links: [],
        groups: [],
        extra: {},
        config: {},
        version: 0.4,
        last_node_id: 0,
        last_link_id: 0
      }))
    },
    canvas: {
      ds: { scale: 1, offset: [0, 0] }
    }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => mockNodeOutputStore)
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: vi.fn(() => mockSubgraphNavigationStore)
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  ComfyWorkflow: class {},
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'

let nodeIdCounter = 0

function createState(nodeCount = 0): ComfyWorkflowJSON {
  const nodes = Array.from({ length: nodeCount }, () => ({
    id: ++nodeIdCounter,
    type: 'TestNode',
    pos: [0, 0],
    size: [100, 50],
    flags: {},
    order: 0,
    inputs: [],
    outputs: [],
    properties: {}
  }))
  return {
    nodes,
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: nodeIdCounter,
    last_link_id: 0
  } as unknown as ComfyWorkflowJSON
}

function createTracker(initialState?: ComfyWorkflowJSON): ChangeTracker {
  const state = initialState ?? createState()
  const workflow = { path: '/test/workflow.json' } as never
  const tracker = new ChangeTracker(workflow, state)
  mockWorkflowStore.activeWorkflow = { changeTracker: tracker }
  return tracker
}

function mockCanvasState(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(state as never)
}

describe('ChangeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nodeIdCounter = 0
    ChangeTracker.isLoadingGraph = false
    mockWorkflowStore.activeWorkflow = null
    mockWorkflowStore.getWorkflowByPath.mockReturnValue(null)
  })

  describe('captureCanvasState', () => {
    describe('guards', () => {
      it('is a no-op when app.graph is falsy', () => {
        const tracker = createTracker()
        const original = tracker.activeState

        const spy = vi.spyOn(app, 'graph', 'get').mockReturnValue(null as never)
        tracker.captureCanvasState()
        spy.mockRestore()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
        expect(tracker.activeState).toBe(original)
      })

      it('is a no-op when changeCount > 0', () => {
        const tracker = createTracker()
        tracker.beforeChange()

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      })

      it('is a no-op when isLoadingGraph is true', () => {
        const tracker = createTracker()
        ChangeTracker.isLoadingGraph = true

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      })

      it('is a no-op when _restoringState is true', () => {
        const tracker = createTracker()
        tracker._restoringState = true

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      })

      it('is a no-op and logs error when called on inactive tracker', () => {
        const tracker = createTracker()
        mockWorkflowStore.activeWorkflow = { changeTracker: {} }

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      })
    })

    describe('state capture', () => {
      it('pushes to undoQueue and updates activeState when state differs', () => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = createState(2)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(1)
        expect(tracker.undoQueue[0]).toEqual(initial)
        expect(tracker.activeState).toEqual(changed)
      })

      it('does not push when state is identical', () => {
        const state = createState()
        const tracker = createTracker(state)
        mockCanvasState(state)

        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(0)
      })

      it('clears redoQueue on new change', () => {
        const tracker = createTracker(createState(1))
        tracker.redoQueue.push(createState(3))
        mockCanvasState(createState(2))

        tracker.captureCanvasState()

        expect(tracker.redoQueue).toHaveLength(0)
      })

      it('caps undoQueue at MAX_HISTORY', () => {
        const tracker = createTracker(createState(1))
        for (let i = 0; i < ChangeTracker.MAX_HISTORY; i++) {
          tracker.undoQueue.push(createState(1))
        }
        expect(tracker.undoQueue).toHaveLength(ChangeTracker.MAX_HISTORY)

        mockCanvasState(createState(2))
        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(ChangeTracker.MAX_HISTORY)
      })
    })
  })

  describe('deactivate', () => {
    it('captures canvas state then stores viewport/outputs', () => {
      const tracker = createTracker(createState(1))
      const changed = createState(2)
      mockCanvasState(changed)

      tracker.deactivate()

      expect(tracker.activeState).toEqual(changed)
      expect(mockNodeOutputStore.snapshotOutputs).toHaveBeenCalled()
      expect(mockSubgraphNavigationStore.exportState).toHaveBeenCalled()
    })

    it('is a full no-op when called on inactive tracker', () => {
      const tracker = createTracker()
      mockWorkflowStore.activeWorkflow = { changeTracker: {} }

      tracker.deactivate()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(mockNodeOutputStore.snapshotOutputs).not.toHaveBeenCalled()
    })
  })

  describe('prepareForSave', () => {
    it('captures canvas state when tracker is active', () => {
      const tracker = createTracker(createState(1))
      const changed = createState(2)
      mockCanvasState(changed)

      tracker.prepareForSave()

      expect(tracker.activeState).toEqual(changed)
    })

    it('is a no-op when tracker is inactive', () => {
      const tracker = createTracker()
      const original = tracker.activeState
      mockWorkflowStore.activeWorkflow = { changeTracker: {} }

      tracker.prepareForSave()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(tracker.activeState).toBe(original)
    })
  })

  describe('checkState (deprecated)', () => {
    it('delegates to captureCanvasState', () => {
      const tracker = createTracker(createState(1))
      const changed = createState(2)
      mockCanvasState(changed)

      tracker.checkState()

      expect(tracker.activeState).toEqual(changed)
    })
  })
})
