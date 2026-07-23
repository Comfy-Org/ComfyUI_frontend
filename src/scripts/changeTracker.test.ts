import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock('@/base/assert', () => ({
  assert: mockAssert
}))

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
    loadGraphData: vi.fn(() => Promise.resolve()),
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
import { api } from '@/scripts/api'
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
    mode: 0,
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
    last_link_id: 0,
    definitions: undefined
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

function cloneState(state: ComfyWorkflowJSON): ComfyWorkflowJSON {
  return structuredClone(state)
}

async function createSubgraphState(
  subgraphCount = 1
): Promise<ComfyWorkflowJSON> {
  const rootGraph = createTestRootGraph()

  for (let index = 0; index < subgraphCount; index++) {
    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())
    subgraph.addInput('input', '*')
    subgraph.addOutput('output', '*')
    const host = createTestSubgraphNode(subgraph, { id: 100 + index })
    rootGraph.add(host)
    const interior = new LGraphNode('InteriorNode')
    interior.type = 'InteriorNode'
    interior.pos = [0, 0]
    interior.setSize([100, 50])
    interior.addWidget('number', 'value', 1 + index, () => undefined)
    const input = interior.addInput('input', '*')
    const output = interior.addOutput('output', '*')
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(input, interior)
    subgraph.outputNode.slots[0].connect(output, interior)
  }

  const state = await validateComfyWorkflow(rootGraph.serialize(), (error) => {
    throw new Error(error)
  })
  if (!state) throw new Error('invalid subgraph fixture')
  return state
}

type ExportedSubgraphWithNodes = ExportedSubgraph &
  Required<Pick<ExportedSubgraph, 'nodes'>>

function isExportedSubgraph(
  value: unknown
): value is ExportedSubgraphWithNodes {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes)
  )
}

function getSubgraphDefinition(state: ComfyWorkflowJSON, index = 0) {
  const subgraph = state.definitions?.subgraphs[index]
  if (!isExportedSubgraph(subgraph))
    throw new Error('subgraph definition missing')
  return subgraph
}

function omitOptionalSubgraphCollections(state: ComfyWorkflowJSON) {
  const subgraph = getSubgraphDefinition(state)
  if (!subgraph.nodes[0]) throw new Error('interior node missing')

  delete subgraph.links
  delete subgraph.nodes[0].inputs
  delete subgraph.nodes[0].outputs
}

describe('ChangeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
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

      it('is a no-op and calls assert when called on inactive tracker', () => {
        const tracker = createTracker()
        mockWorkflowStore.activeWorkflow = { changeTracker: {} }

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
        expect(mockAssert).toHaveBeenCalledWith(
          false,
          expect.stringContaining('captureCanvasState')
        )
      })
    })

    describe('state capture', () => {
      it('pushes to undoQueue, updates activeState, and calls updateModified', () => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = createState(2)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(1)
        expect(tracker.undoQueue[0]).toEqual(initial)
        expect(tracker.activeState).toEqual(changed)
        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'executionGraphChanged',
          changed
        )
      })

      it('does not push when state is identical', () => {
        const state = createState()
        const tracker = createTracker(state)
        mockCanvasState(state)

        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(0)
      })

      it.for([
        {
          name: 'node position',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].pos = [40, 50]
          }
        },
        {
          name: 'node size',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].size = [200, 100]
          }
        },
        {
          name: 'collapsed state',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].flags = { collapsed: true }
          }
        },
        {
          name: 'node title',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].title = 'Renamed node'
          }
        },
        {
          name: 'group layout',
          mutate: (state: ComfyWorkflowJSON) => {
            state.groups = [
              {
                title: 'Test Group',
                bounding: [0, 0, 400, 300]
              }
            ]
          }
        }
      ])('does not dispatch executionGraphChanged for $name', ({ mutate }) => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        mutate(changed)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'executionGraphChanged',
          expect.anything()
        )
      })

      it('does not dispatch a graph change for the canvas viewport', () => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        changed.extra = {
          ds: {
            scale: 2,
            offset: [40, 50]
          }
        }
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
      })

      it('ignores link metadata changes that preserve the connection', () => {
        const initial = createState(2)
        initial.links = [
          [1, initial.nodes[0].id, 0, initial.nodes[1].id, 0, '*']
        ]
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        changed.links = [
          [2, changed.nodes[0].id, 0, changed.nodes[1].id, 0, '*']
        ]
        changed.reroutes = [{ id: 1, pos: [40, 50], linkIds: [2] }]
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'executionGraphChanged',
          expect.anything()
        )
      })

      it.for([
        {
          name: 'widget value',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].widgets_values = [2]
          }
        },
        {
          name: 'node mode',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].mode = 2
          }
        },
        {
          name: 'connection',
          mutate: (state: ComfyWorkflowJSON) => {
            state.links = [[1, state.nodes[0].id, 0, state.nodes[1].id, 0, '*']]
          }
        }
      ])(
        'dispatches executionGraphChanged for a $name change',
        ({ mutate }) => {
          const initial = createState(2)
          const tracker = createTracker(initial)
          const changed = cloneState(initial)
          mutate(changed)
          mockCanvasState(changed)

          tracker.captureCanvasState()

          expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
            'executionGraphChanged',
            changed
          )
        }
      )

      it('ignores layout changes inside a subgraph', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        const interior = getSubgraphDefinition(changed).nodes[0]
        if (!interior) throw new Error('interior node missing')
        interior.pos = [40, 50]
        interior.size = [200, 100]
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'executionGraphChanged',
          expect.anything()
        )
      })

      it('detects widget changes inside a subgraph', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        const interior = getSubgraphDefinition(changed).nodes[0]
        if (!interior) throw new Error('interior node missing')
        interior.widgets_values = [2]
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'executionGraphChanged',
          changed
        )
      })

      it('detects data changes when optional subgraph collections are omitted', async () => {
        const initial = await createSubgraphState()
        const changed = cloneState(initial)
        const interior = getSubgraphDefinition(changed).nodes[0]
        if (!interior) throw new Error('interior node missing')
        interior.widgets_values = [2]
        omitOptionalSubgraphCollections(initial)
        omitOptionalSubgraphCollections(changed)
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'executionGraphChanged',
          changed
        )
      })

      it('ignores subgraph presentation metadata changes', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        const subgraph = getSubgraphDefinition(changed)
        subgraph.name = 'Renamed subgraph'
        subgraph.description = 'Updated description'
        subgraph.category = 'Updated category'
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'executionGraphChanged',
          expect.anything()
        )
      })

      it('ignores subgraph definition order changes', async () => {
        const initial = await createSubgraphState(2)
        const tracker = createTracker(initial)
        const changed = cloneState(initial)
        const subgraphs = changed.definitions?.subgraphs
        if (!subgraphs) throw new Error('subgraph definitions missing')
        subgraphs.reverse()
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'executionGraphChanged',
          expect.anything()
        )
      })

      it.for(['Note', 'MarkdownNote'])(
        'ignores content changes to the %s node',
        (nodeType) => {
          const initial = createState(1)
          initial.nodes[0].type = nodeType
          initial.nodes[0].widgets_values = ['Initial content']
          const tracker = createTracker(initial)
          const changed = cloneState(initial)
          changed.nodes[0].widgets_values = ['Updated content']
          mockCanvasState(changed)

          tracker.captureCanvasState()

          expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
            'graphChanged',
            changed
          )
          expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
            'executionGraphChanged',
            expect.anything()
          )
        }
      )

      it('clears redoQueue on new change', () => {
        const tracker = createTracker(createState(1))
        tracker.redoQueue.push(createState(3))
        mockCanvasState(createState(2))

        tracker.captureCanvasState()

        expect(tracker.redoQueue).toHaveLength(0)
      })

      it('produces a single undo entry for a beforeChange/afterChange transaction', () => {
        const tracker = createTracker(createState(1))
        const intermediate = createState(2)
        const final = createState(3)

        tracker.beforeChange()
        mockCanvasState(intermediate)
        tracker.captureCanvasState()
        expect(tracker.undoQueue).toHaveLength(0)

        mockCanvasState(final)
        tracker.afterChange()

        expect(tracker.undoQueue).toHaveLength(1)
        expect(tracker.activeState).toEqual(final)
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

  describe('undo and redo', () => {
    it('dispatches executionGraphChanged for a data change in both directions', async () => {
      const initial = createState(1)
      const changed = cloneState(initial)
      changed.nodes[0].widgets_values = [2]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)

      await tracker.undo()

      expect(app.loadGraphData).toHaveBeenCalled()
      expect(tracker.activeState).toEqual(initial)
      expect(tracker.redoQueue).toEqual([changed])
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
        'executionGraphChanged',
        initial
      )

      vi.mocked(api.dispatchCustomEvent).mockClear()
      await tracker.redo()

      expect(tracker.activeState).toEqual(changed)
      expect(tracker.undoQueue).toEqual([initial])
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
        'executionGraphChanged',
        changed
      )
    })

    it('does not dispatch executionGraphChanged for layout-only undo or redo', async () => {
      const initial = createState(1)
      const changed = cloneState(initial)
      changed.nodes[0].size = [200, 100]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)

      await tracker.undo()

      expect(tracker.activeState).toEqual(initial)
      expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
        'executionGraphChanged',
        expect.anything()
      )

      vi.mocked(api.dispatchCustomEvent).mockClear()
      await tracker.redo()

      expect(tracker.activeState).toEqual(changed)
      expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
        'executionGraphChanged',
        expect.anything()
      )
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

    it('skips captureCanvasState but still calls store during undo/redo', () => {
      const tracker = createTracker(createState(1))
      tracker._restoringState = true

      tracker.deactivate()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(mockNodeOutputStore.snapshotOutputs).toHaveBeenCalled()
    })

    it('is a full no-op and calls assert when called on inactive tracker', () => {
      const tracker = createTracker()
      mockWorkflowStore.activeWorkflow = { changeTracker: {} }

      tracker.deactivate()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(mockNodeOutputStore.snapshotOutputs).not.toHaveBeenCalled()
      expect(mockAssert).toHaveBeenCalledWith(
        false,
        expect.stringContaining('deactivate')
      )
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
