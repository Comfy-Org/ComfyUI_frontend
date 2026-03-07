import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { ChangeTracker } from './changeTracker'

const mockApp = vi.hoisted(() => ({
  graph: { _nodes: [] } as Record<string, unknown>,
  rootGraph: { serialize: vi.fn() } as Record<string, unknown>,
  canvas: { ds: { scale: 1, offset: [0, 0] } },
  loadGraphData: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn()
  }
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: vi.fn()
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  ComfyWorkflow: class {},
  useWorkflowStore: () => ({
    getWorkflowByPath: vi.fn(),
    activeWorkflow: null
  })
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    snapshotOutputs: vi.fn(() => ({})),
    restoreOutputs: vi.fn()
  })
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({
    exportState: vi.fn(() => []),
    restoreState: vi.fn()
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    queuedJobs: {}
  })
}))

function makeNode(
  id: number,
  overrides: Record<string, unknown> = {}
): ComfyWorkflowJSON['nodes'][number] {
  return {
    id,
    type: 'TestNode',
    pos: [100, 200],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    ...overrides
  }
}

function makeWorkflow(
  overrides: Partial<ComfyWorkflowJSON> = {}
): ComfyWorkflowJSON {
  return {
    last_node_id: 1,
    last_link_id: 0,
    nodes: [makeNode(1)],
    links: [],
    groups: [],
    extra: {},
    version: 0.4,
    ...overrides
  } as ComfyWorkflowJSON
}

describe('ChangeTracker store contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('graphEqual', () => {
    it('returns true for identical snapshots', () => {
      const workflow = makeWorkflow()
      expect(ChangeTracker.graphEqual(workflow, workflow)).toBe(true)
    })

    it('returns true for equivalent snapshots with same data', () => {
      const a = makeWorkflow()
      const b = makeWorkflow()
      expect(ChangeTracker.graphEqual(a, b)).toBe(true)
    })

    it('excludes viewport (ds) from comparison', () => {
      const a = makeWorkflow({
        extra: { ds: { scale: 1, offset: [0, 0] } }
      })
      const b = makeWorkflow({
        extra: { ds: { scale: 2.5, offset: [500, -300] } }
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(true)
    })

    it('detects changes in extra properties other than ds', () => {
      const a = makeWorkflow({
        extra: { ds: { scale: 1, offset: [0, 0] }, foo: 'bar' }
      })
      const b = makeWorkflow({
        extra: { ds: { scale: 1, offset: [0, 0] }, foo: 'baz' }
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('detects node position changes', () => {
      const a = makeWorkflow({ nodes: [makeNode(1, { pos: [100, 200] })] })
      const b = makeWorkflow({ nodes: [makeNode(1, { pos: [300, 400] })] })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('detects node size changes', () => {
      const a = makeWorkflow({ nodes: [makeNode(1, { size: [200, 100] })] })
      const b = makeWorkflow({ nodes: [makeNode(1, { size: [400, 200] })] })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('detects node flag changes', () => {
      const a = makeWorkflow({ nodes: [makeNode(1, { flags: {} })] })
      const b = makeWorkflow({
        nodes: [makeNode(1, { flags: { collapsed: true } })]
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('detects link changes', () => {
      const a = makeWorkflow({ links: [] })
      const b = makeWorkflow({
        links: [[1, 1, 0, 2, 0, 'MODEL']]
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('detects group changes', () => {
      const a = makeWorkflow({ groups: [] })
      const b = makeWorkflow({
        groups: [{ title: 'Group 1', bounding: [0, 0, 100, 100] }]
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(false)
    })

    it('treats node order as irrelevant', () => {
      const a = makeWorkflow({
        nodes: [makeNode(1, { pos: [0, 0] }), makeNode(2, { pos: [100, 100] })]
      })
      const b = makeWorkflow({
        nodes: [makeNode(2, { pos: [100, 100] }), makeNode(1, { pos: [0, 0] })]
      })
      expect(ChangeTracker.graphEqual(a, b)).toBe(true)
    })
  })

  describe('checkState', () => {
    it('pushes to undoQueue when graph state changes', () => {
      const initialState = makeWorkflow()
      const changedState = makeWorkflow({
        nodes: [makeNode(1, { pos: [999, 999] })]
      })

      mockApp.graph = { _nodes: [] }
      mockApp.rootGraph = { serialize: vi.fn(() => changedState) }

      const tracker = new ChangeTracker(
        {} as never,
        JSON.parse(JSON.stringify(initialState))
      )

      tracker.checkState()

      expect(tracker.undoQueue).toHaveLength(1)
      expect(tracker.activeState).toEqual(changedState)
      expect(tracker.redoQueue).toHaveLength(0)
    })

    it('does not push to undoQueue when graph state is unchanged', () => {
      const state = makeWorkflow()

      mockApp.graph = { _nodes: [] }
      mockApp.rootGraph = {
        serialize: vi.fn(() => JSON.parse(JSON.stringify(state)))
      }

      const tracker = new ChangeTracker(
        {} as never,
        JSON.parse(JSON.stringify(state))
      )

      tracker.checkState()

      expect(tracker.undoQueue).toHaveLength(0)
    })

    it('clears redoQueue when a new change is detected', () => {
      const initialState = makeWorkflow()
      const changedState = makeWorkflow({
        nodes: [makeNode(1, { pos: [999, 999] })]
      })

      mockApp.graph = { _nodes: [] }
      mockApp.rootGraph = { serialize: vi.fn(() => changedState) }

      const tracker = new ChangeTracker(
        {} as never,
        JSON.parse(JSON.stringify(initialState))
      )
      tracker.redoQueue.push(makeWorkflow())

      tracker.checkState()

      expect(tracker.redoQueue).toHaveLength(0)
    })
  })
})
