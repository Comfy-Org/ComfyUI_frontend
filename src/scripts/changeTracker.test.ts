import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createNestedSubgraphs,
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

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
    },
    ui: {
      autoQueueEnabled: false,
      autoQueueMode: 'instant'
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
let workflowPathCounter = 0

function createState(nodeCount = 0): ComfyWorkflowJSON {
  const nodes: ComfyWorkflowJSON['nodes'] = Array.from(
    { length: nodeCount },
    () => ({
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
    })
  )
  return {
    nodes,
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: nodeIdCounter,
    last_link_id: 0
  }
}

function createTracker(initialState?: ComfyWorkflowJSON): ChangeTracker {
  const state = initialState ?? createState()
  const workflow = {
    path: `/test/workflow-${++workflowPathCounter}.json`
  } as never
  const tracker = new ChangeTracker(workflow, state)
  mockWorkflowStore.activeWorkflow = { changeTracker: tracker }
  return tracker
}

function mockCanvasState(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(state as never)
}

function dispatchedEventNames() {
  return vi.mocked(api.dispatchCustomEvent).mock.calls.map(([event]) => event)
}

function expectAutoQueueGraphChangedNotDispatched() {
  expect(dispatchedEventNames()).not.toContain('autoQueueGraphChanged')
}

async function requireValidWorkflow(value: unknown) {
  const state = await validateComfyWorkflow(value, (error) => {
    throw new Error(error)
  })
  if (!state) throw new Error('invalid workflow fixture')
  return JSON.parse(JSON.stringify(state)) as ComfyWorkflowJSON
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
    const interior = new LGraphNode('InteriorNode', 'InteriorNode')
    interior.pos = [0, 0]
    interior.setSize([100, 50])
    interior.addWidget('number', 'value', 1 + index, () => undefined)
    const input = interior.addInput('input', '*')
    const output = interior.addOutput('output', '*')
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(input, interior)
    subgraph.outputNode.slots[0].connect(output, interior)
  }

  return await requireValidWorkflow(rootGraph.serialize())
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

function findSubgraphDefinition(
  state: ComfyWorkflowJSON | ExportedSubgraphWithNodes,
  id: string
): ExportedSubgraphWithNodes | undefined {
  for (const subgraph of state.definitions?.subgraphs ?? []) {
    if (!isExportedSubgraph(subgraph)) continue
    if (subgraph.id === id) return subgraph
    const nested = findSubgraphDefinition(subgraph, id)
    if (nested) return nested
  }
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
    resetSubgraphFixtureState()
    nodeIdCounter = 0
    ChangeTracker.isLoadingGraph = false
    ChangeTracker.resetCheckStateWarningForTest()
    mockWorkflowStore.activeWorkflow = null
    mockWorkflowStore.getWorkflowByPath.mockReturnValue(null)
    mockCanvasState(createState())
    useQueueSettingsStore().mode = 'change'
    app.ui.autoQueueEnabled = false
    app.ui.autoQueueMode = 'instant'
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
          expect.stringContaining('captureCanvasState'),
          expect.objectContaining({ workflowPath: expect.any(String) })
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
          'autoQueueGraphChanged'
        )
      })

      it.for(['disabled', 'instant-idle', 'instant-running'] as const)(
        'does not dispatch an auto-queue change in %s mode',
        (mode) => {
          useQueueSettingsStore().mode = mode
          const initial = createState(1)
          const changed = structuredClone(initial)
          changed.nodes[0].widgets_values = [2]
          const tracker = createTracker(initial)
          mockCanvasState(changed)

          tracker.captureCanvasState()

          expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
            'graphChanged',
            changed
          )
          expectAutoQueueGraphChangedNotDispatched()
        }
      )

      it('does not dispatch an auto-queue change for legacy instant mode', () => {
        useQueueSettingsStore().mode = 'disabled'
        app.ui.autoQueueEnabled = true
        app.ui.autoQueueMode = 'instant'
        const initial = createState(1)
        const changed = structuredClone(initial)
        changed.nodes[0].widgets_values = [2]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('dispatches auto-queue changes for legacy Run on change mode', () => {
        useQueueSettingsStore().mode = 'disabled'
        app.ui.autoQueueEnabled = true
        app.ui.autoQueueMode = 'change'
        const initial = createState(1)
        const changed = structuredClone(initial)
        changed.nodes[0].widgets_values = [2]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('detects a change after a listener mutates the prior checkpoint', () => {
        const initial = createState(1)
        initial.nodes[0].widgets_values = [0]
        const canvasState = structuredClone(initial)
        canvasState.nodes[0].widgets_values = [1]
        const tracker = createTracker(initial)
        mockCanvasState(canvasState)
        vi.mocked(api.dispatchCustomEvent).mockImplementationOnce((event) => {
          if (event === 'graphChanged') {
            tracker.activeState.nodes[0].widgets_values = [2]
          }
          return true
        })

        tracker.captureCanvasState()
        vi.mocked(api.dispatchCustomEvent).mockClear()
        mockCanvasState(canvasState)
        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('decides execution relevance before graphChanged listeners run', () => {
        const initial = createState(1)
        initial.nodes[0].widgets_values = [1]
        const changed = structuredClone(initial)
        changed.nodes[0].widgets_values = [2]
        const tracker = createTracker(initial)
        mockCanvasState(changed)
        vi.mocked(api.dispatchCustomEvent).mockImplementation((event) => {
          if (event === 'graphChanged') {
            tracker.activeState.nodes[0].widgets_values = [1]
          }
          return true
        })

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('squashes late serialized updates into the captured state', async () => {
        const initial = createState(1)
        const changed = structuredClone(initial)
        changed.nodes[0].widgets_values = [2]
        const squashed = structuredClone(changed)
        squashed.nodes[0].widgets_values = [3]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()
        mockCanvasState(squashed)
        await vi.advanceTimersByTimeAsync(50)

        expect(tracker.activeState).toEqual(squashed)
        expect(tracker.undoQueue).toEqual([initial])
        expect(dispatchedEventNames()).toEqual([
          'graphChanged',
          'autoQueueGraphChanged',
          'graphChanged',
          'autoQueueGraphChanged'
        ])
      })

      it('does not emit an execution change for a late layout-only update', async () => {
        const initial = createState(1)
        const changed = structuredClone(initial)
        changed.nodes[0].widgets_values = [2]
        const squashed = structuredClone(changed)
        squashed.nodes[0].pos = [40, 50]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()
        vi.mocked(api.dispatchCustomEvent).mockClear()
        mockCanvasState(squashed)
        await vi.advanceTimersByTimeAsync(50)

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          squashed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it.for([
        {
          name: 'tracker becomes inactive',
          blockSquash: () => {
            mockWorkflowStore.activeWorkflow = { changeTracker: {} }
          }
        },
        {
          name: 'graph loading starts',
          blockSquash: () => {
            ChangeTracker.isLoadingGraph = true
          }
        }
      ])(
        'does not squash when $name before the debounce finishes',
        async ({ blockSquash }) => {
          const initial = createState(1)
          const changed = structuredClone(initial)
          changed.nodes[0].widgets_values = [2]
          const lateState = structuredClone(changed)
          lateState.nodes[0].widgets_values = [3]
          const tracker = createTracker(initial)
          mockCanvasState(changed)

          tracker.captureCanvasState()
          mockCanvasState(lateState)
          blockSquash()
          await vi.advanceTimersByTimeAsync(50)

          expect(tracker.activeState).toEqual(changed)
        }
      )

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
          name: 'node colors',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes[0].color = '#112233'
            state.nodes[0].bgcolor = '#445566'
            state.nodes[0].boxcolor = '#778899'
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
      ])('does not dispatch autoQueueGraphChanged for $name', ({ mutate }) => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
        mutate(changed)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('does not dispatch a graph change for the canvas viewport', () => {
        const initial = createState(1)
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
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
        const changed = structuredClone(initial)
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
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('normalizes equivalent v0.4 and v1 links', async () => {
        const initial = createState(2)
        initial.links = [
          [1, initial.nodes[0].id, 1, initial.nodes[1].id, 2, '*']
        ]
        Reflect.set(initial.links[0], 2, '1')
        Reflect.set(initial.links[0], 4, '2')
        const changed = await requireValidWorkflow({
          ...structuredClone(initial),
          version: 1,
          state: {
            lastGroupId: 0,
            lastNodeId: initial.last_node_id,
            lastLinkId: initial.last_link_id,
            lastRerouteId: 0
          },
          links: [
            {
              id: 1,
              origin_id: initial.nodes[0].id,
              origin_slot: 1,
              target_id: initial.nodes[1].id,
              target_slot: 2,
              type: '*'
            }
          ]
        })
        changed.nodes[0].pos = [40, 50]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('normalizes omitted v1 links and empty v0.4 links', async () => {
        const initial = await requireValidWorkflow({
          ...createState(1),
          version: 1,
          state: {
            lastGroupId: 0,
            lastNodeId: 1,
            lastLinkId: 0,
            lastRerouteId: 0
          }
        })
        Reflect.deleteProperty(initial, 'links')
        const changed = createState(1)
        changed.nodes[0].id = initial.nodes[0].id
        changed.nodes[0].pos = [40, 50]
        changed.last_node_id = Number(initial.nodes[0].id)
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('normalizes string and numeric link slot indices', async () => {
        const base = createState(2)
        const initial = await requireValidWorkflow({
          ...base,
          version: 1,
          state: {
            lastGroupId: 0,
            lastNodeId: base.last_node_id,
            lastLinkId: 1,
            lastRerouteId: 0
          },
          links: [
            {
              id: 1,
              origin_id: base.nodes[0].id,
              origin_slot: 1,
              target_id: base.nodes[1].id,
              target_slot: 2,
              type: '*'
            }
          ]
        })
        const initialLink = initial.links?.[0]
        if (!initialLink || Array.isArray(initialLink)) {
          throw new Error('Expected a v1 object link')
        }
        Object.assign(initialLink, {
          origin_slot: '1',
          target_slot: '2'
        })
        const changed = structuredClone(base)
        changed.links = [[1, base.nodes[0].id, 1, base.nodes[1].id, 2, '*']]
        changed.nodes[0].pos = [40, 50]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('normalizes string and numeric node IDs', () => {
        const initial = createState(2)
        initial.links = [
          [1, initial.nodes[0].id, 0, initial.nodes[1].id, 0, '*']
        ]
        const changed = structuredClone(initial)
        for (const node of initial.nodes) {
          node.id = String(node.id)
        }
        const initialLink = initial.links[0]
        if (!initialLink) throw new Error('link missing')
        initialLink[1] = String(initialLink[1])
        initialLink[3] = String(initialLink[3])
        changed.nodes[0].pos = [40, 50]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('detects v1 link endpoint changes', async () => {
        const base = createState(2)
        const initial = await requireValidWorkflow({
          ...base,
          version: 1,
          state: {
            lastGroupId: 0,
            lastNodeId: base.last_node_id,
            lastLinkId: 1,
            lastRerouteId: 0
          },
          links: [
            {
              id: 1,
              origin_id: base.nodes[0].id,
              origin_slot: 1,
              target_id: base.nodes[1].id,
              target_slot: 2,
              type: '*'
            }
          ]
        })
        const changed = structuredClone(initial)
        const changedLink = changed.links?.[0]
        if (!changedLink || Array.isArray(changedLink)) {
          throw new Error('Expected a v1 object link')
        }
        changedLink.target_slot = 3
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('ignores serialized input slot index drift', () => {
        const initial = createState(1)
        initial.nodes[0].inputs = [
          {
            name: 'input',
            type: '*',
            link: null,
            slot_index: 2
          }
        ]
        const changed = structuredClone(initial)
        Reflect.deleteProperty(changed.nodes[0].inputs?.[0] ?? {}, 'slot_index')
        changed.nodes[0].pos = [40, 50]
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('ignores slot presentation metadata changes', () => {
        const initial = createState(1)
        initial.nodes[0].inputs = [
          {
            name: 'input',
            type: '*',
            link: null
          }
        ]
        initial.nodes[0].outputs = [
          {
            name: 'output',
            type: '*',
            links: []
          }
        ]
        const changed = structuredClone(initial)
        Object.assign(changed.nodes[0].inputs?.[0] ?? {}, {
          label: 'Input label',
          localized_name: 'Localized input',
          color_on: '#112233',
          color_off: '#445566'
        })
        Object.assign(changed.nodes[0].outputs?.[0] ?? {}, {
          label: 'Output label',
          localized_name: 'Localized output',
          color_on: '#778899',
          color_off: '#aabbcc'
        })
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('ignores link ordering changes', () => {
        const initial = createState(3)
        initial.links = [
          [1, initial.nodes[0].id, 0, initial.nodes[1].id, 0, '*'],
          [2, initial.nodes[1].id, 0, initial.nodes[2].id, 0, '*']
        ]
        const changed = structuredClone(initial)
        if (!changed.links) throw new Error('links missing')
        changed.links.reverse()
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
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
        },
        {
          name: 'node addition',
          mutate: (state: ComfyWorkflowJSON) => {
            const addedNode = structuredClone(state.nodes[0])
            addedNode.id = 999
            state.nodes.push(addedNode)
          }
        },
        {
          name: 'node removal',
          mutate: (state: ComfyWorkflowJSON) => {
            state.nodes.pop()
          }
        }
      ])(
        'dispatches autoQueueGraphChanged for a $name change',
        ({ mutate }) => {
          const initial = createState(2)
          const tracker = createTracker(initial)
          const changed = structuredClone(initial)
          mutate(changed)
          mockCanvasState(changed)

          tracker.captureCanvasState()

          expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
            'autoQueueGraphChanged'
          )
        }
      )

      it('ignores layout changes inside a subgraph', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
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
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('detects widget changes inside a subgraph', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
        const interior = getSubgraphDefinition(changed).nodes[0]
        if (!interior) throw new Error('interior node missing')
        interior.widgets_values = [2]
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('detects widget changes inside a nested subgraph', async () => {
        const nested = createNestedSubgraphs({
          depth: 2,
          nodesPerLevel: 1
        })
        const leafNode = nested.leafSubgraph?.nodes[0]
        if (!leafNode) throw new Error('nested leaf node missing')
        for (const subgraph of nested.subgraphs) {
          nested.rootGraph.subgraphs.set(subgraph.id, subgraph)
        }
        const initial = await requireValidWorkflow(nested.rootGraph.serialize())
        const leafId = nested.leafSubgraph?.id
        if (!leafId) throw new Error('nested leaf id missing')
        const rootDefinitions = initial.definitions?.subgraphs
        if (!rootDefinitions) throw new Error('subgraph definitions missing')
        const leafIndex = rootDefinitions.findIndex(
          (subgraph) => subgraph.id === leafId
        )
        const parent = rootDefinitions.find(
          (subgraph) => subgraph.id !== leafId
        )
        if (leafIndex === -1 || !parent) {
          throw new Error('nested subgraph definitions missing')
        }
        const [leaf] = rootDefinitions.splice(leafIndex, 1)
        if (!leaf) throw new Error('nested leaf definition missing')
        parent.definitions = { subgraphs: [leaf] }
        const initialLeaf = findSubgraphDefinition(initial, leafId)
        if (!initialLeaf) throw new Error('nested leaf definition missing')
        const initialLeafNode = initialLeaf.nodes[0]
        if (!initialLeafNode) throw new Error('nested leaf node missing')
        initialLeafNode.widgets_values = [1]
        const tracker = createTracker(initial)

        const changed = structuredClone(initial)
        const changedLeaf = findSubgraphDefinition(changed, leafId)
        if (!changedLeaf) throw new Error('nested leaf definition missing')
        const changedLeafNode = changedLeaf.nodes[0]
        if (!changedLeafNode) throw new Error('nested leaf node missing')
        changedLeafNode.widgets_values = [2]
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('detects data changes when optional subgraph collections are omitted', async () => {
        const initial = await createSubgraphState()
        const changed = structuredClone(initial)
        const interior = getSubgraphDefinition(changed).nodes[0]
        if (!interior) throw new Error('interior node missing')
        interior.widgets_values = [2]
        omitOptionalSubgraphCollections(initial)
        omitOptionalSubgraphCollections(changed)
        const tracker = createTracker(initial)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'autoQueueGraphChanged'
        )
      })

      it('ignores subgraph presentation metadata changes', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
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
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('ignores subgraph boundary-node layout changes', async () => {
        const initial = await createSubgraphState()
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
        const subgraph = getSubgraphDefinition(changed)
        subgraph.inputNode.bounding = [10, 20, 30, 40]
        subgraph.inputNode.pinned = true
        subgraph.outputNode.bounding = [50, 60, 70, 80]
        subgraph.outputNode.pinned = true
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it('ignores subgraph definition order changes', async () => {
        const initial = await createSubgraphState(2)
        const tracker = createTracker(initial)
        const changed = structuredClone(initial)
        const subgraphs = changed.definitions?.subgraphs
        if (!subgraphs) throw new Error('subgraph definitions missing')
        subgraphs.reverse()
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
          'graphChanged',
          changed
        )
        expectAutoQueueGraphChangedNotDispatched()
      })

      it.for(['Note', 'MarkdownNote'])(
        'ignores content changes to the %s node',
        (nodeType) => {
          const initial = createState(1)
          initial.nodes[0].type = nodeType
          initial.nodes[0].widgets_values = ['Initial content']
          const tracker = createTracker(initial)
          const changed = structuredClone(initial)
          changed.nodes[0].widgets_values = ['Updated content']
          mockCanvasState(changed)

          tracker.captureCanvasState()

          expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
            'graphChanged',
            changed
          )
          expectAutoQueueGraphChangedNotDispatched()
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
    it('dispatches autoQueueGraphChanged for a data change in both directions', async () => {
      const initial = createState(1)
      const changed = structuredClone(initial)
      changed.nodes[0].widgets_values = [2]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)

      await tracker.undo()

      expect(app.loadGraphData).toHaveBeenCalled()
      expect(tracker.activeState).toEqual(initial)
      expect(tracker.redoQueue).toEqual([changed])
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
        'autoQueueGraphChanged'
      )

      vi.mocked(api.dispatchCustomEvent).mockClear()
      await tracker.redo()

      expect(tracker.activeState).toEqual(changed)
      expect(tracker.undoQueue).toEqual([initial])
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
        'autoQueueGraphChanged'
      )
    })

    it('does not dispatch autoQueueGraphChanged for layout-only undo or redo', async () => {
      const initial = createState(1)
      const changed = structuredClone(initial)
      changed.nodes[0].size = [200, 100]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)

      await tracker.undo()

      expect(tracker.activeState).toEqual(initial)
      expectAutoQueueGraphChangedNotDispatched()

      vi.mocked(api.dispatchCustomEvent).mockClear()
      await tracker.redo()

      expect(tracker.activeState).toEqual(changed)
      expectAutoQueueGraphChangedNotDispatched()
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
        expect.stringContaining('deactivate'),
        expect.objectContaining({ workflowPath: expect.any(String) })
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
    it('captures each state and warns once across repeated calls', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const tracker = createTracker(createState(1))
      const firstChanged = createState(2)
      mockCanvasState(firstChanged)

      tracker.checkState()

      expect(tracker.activeState).toEqual(firstChanged)

      const secondChanged = createState(3)
      mockCanvasState(secondChanged)
      tracker.checkState()

      expect(tracker.activeState).toEqual(secondChanged)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledWith(
        'checkState() is deprecated — use captureCanvasState() instead.'
      )
    })
  })

  describe('keyboard shortcuts', () => {
    function createRekaDialog() {
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('data-state', 'open')
      return dialog
    }

    function createNativeDialog() {
      const dialog = document.createElement('dialog')
      dialog.setAttribute('open', '')
      return dialog
    }

    function createLegacyComfyModal() {
      const modal = document.createElement('div')
      modal.className = 'comfy-modal'
      modal.style.display = 'flex'
      return modal
    }

    it.each([
      ['a reka dialog', createRekaDialog],
      ['a native dialog', createNativeDialog],
      ['a legacy comfy modal', createLegacyComfyModal]
    ])('does not undo while %s is open', async (_kind, createModal) => {
      const previousState = createState(1)
      const currentState = createState(2)
      const tracker = createTracker(currentState)
      tracker.undoQueue.push(previousState)
      const modal = createModal()
      document.body.appendChild(modal)

      try {
        ChangeTracker.init()
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
        )
        await vi.runAllTimersAsync()

        expect(app.loadGraphData).not.toHaveBeenCalled()
        expect(tracker.activeState).toEqual(currentState)
        expect(tracker.undoQueue).toEqual([previousState])
      } finally {
        document.body.removeChild(modal)
      }
    })
  })
})
