import { fromPartial } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { markRaw, ref } from 'vue'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

import {
  createNestedSubgraphs,
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/LGraph'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { isBoundsObject } from '@/renderer/core/layout/utils/geometry'
import { useBoundingBoxWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBoundingBoxWidget'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import type { BoundingBox } from '@/types/boundingBoxes'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({
  assert: mockAssert
}))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/scripts/api'))

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
    path: `/test/workflow-${++workflowPathCounter}.json`,
    graph: app.rootGraph
  } as never
  const tracker = markRaw(new ChangeTracker(workflow, state))
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: tracker
  })
  return tracker
}

function mockCanvasState(state: ComfyWorkflowJSON) {
  vi.spyOn(app.rootGraph, 'serialize').mockReturnValue(state as never)
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
    useWorkflowStore().activeWorkflow = null
    vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(null)
    mockCanvasState(createState())
    useQueueSettingsStore().mode = 'change'
    app.ui.autoQueueEnabled = false
    app.ui.autoQueueMode = 'instant'
    vi.mocked(useSubgraphNavigationStore().exportState).mockReturnValue([])
    vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
      () => {}
    )
    app.rootGraph.subgraphs.clear()
    vi.mocked(app.loadGraphData).mockImplementation(async (state) => {
      const restored = await requireValidWorkflow(state)
      useWorkflowStore().activeWorkflow?.changeTracker.reset(restored)
      mockCanvasState(restored)
      return true
    })
  })

  describe('undoRedo', () => {
    it.for([
      {
        key: 'z',
        shiftKey: false,
        history: 'undo',
        selectOnly: false,
        calls: 1
      },
      {
        key: 'z',
        shiftKey: false,
        history: 'undo',
        selectOnly: true,
        calls: 0
      },
      { key: 'z', shiftKey: true, history: 'redo', selectOnly: true, calls: 0 },
      { key: 'y', shiftKey: false, history: 'redo', selectOnly: true, calls: 0 }
    ] as const)(
      'Ctrl+$key shift=$shiftKey with selectOnly=$selectOnly consumes the key and runs $history $calls times',
      async ({ key, shiftKey, history, selectOnly, calls }) => {
        const tracker = createTracker()
        const run = vi.spyOn(tracker, history).mockResolvedValue()
        app.canvas.selectOnly = selectOnly
        onTestFinished(() => {
          app.canvas.selectOnly = false
        })

        const handled = await tracker.undoRedo(
          new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey })
        )

        expect(handled).toBe(true)
        expect(run).toHaveBeenCalledTimes(calls)
      }
    )

    it.for([
      { key: 'a', ctrlKey: true, shiftKey: false, altKey: false },
      { key: 'z', ctrlKey: false, shiftKey: false, altKey: false },
      { key: 'z', ctrlKey: true, shiftKey: false, altKey: true },
      { key: 'y', ctrlKey: true, shiftKey: true, altKey: false }
    ])(
      '$key ctrl=$ctrlKey shift=$shiftKey alt=$altKey is not a history shortcut',
      async ({ key, ctrlKey, shiftKey, altKey }) => {
        const tracker = createTracker()
        const undo = vi.spyOn(tracker, 'undo').mockResolvedValue()
        const redo = vi.spyOn(tracker, 'redo').mockResolvedValue()

        const handled = await tracker.undoRedo(
          new KeyboardEvent('keydown', { key, ctrlKey, shiftKey, altKey })
        )

        expect(handled).toBeUndefined()
        expect(undo).not.toHaveBeenCalled()
        expect(redo).not.toHaveBeenCalled()
      }
    )

    it.for([
      { selectOnlyAtKeydown: true, selectOnlyAtFrame: false, undoCalls: 0 },
      { selectOnlyAtKeydown: false, selectOnlyAtFrame: true, undoCalls: 1 }
    ])(
      'Ctrl+Z with selectOnly=$selectOnlyAtKeydown at keydown and $selectOnlyAtFrame at the frame undoes $undoCalls times',
      async ({ selectOnlyAtKeydown, selectOnlyAtFrame, undoCalls }) => {
        const tracker = createTracker()
        const undo = vi.spyOn(tracker, 'undo').mockResolvedValue()
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) =>
          frames.push(frame)
        )
        const addEventListener = vi
          .spyOn(window, 'addEventListener')
          .mockImplementation(() => {})
        ChangeTracker.init()
        const keydown = addEventListener.mock.calls.find(
          ([type]) => type === 'keydown'
        )?.[1]
        if (typeof keydown !== 'function')
          throw new Error('keydown listener missing')
        onTestFinished(() => {
          app.canvas.selectOnly = false
        })

        app.canvas.selectOnly = selectOnlyAtKeydown
        keydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
        app.canvas.selectOnly = selectOnlyAtFrame
        expect(frames).toHaveLength(1)
        await frames[0](0)

        expect(undo).toHaveBeenCalledTimes(undoCalls)
      }
    )

    describe('modifier release around history shortcuts', () => {
      let events: EventTarget
      let frames: FrameRequestCallback[]

      beforeEach(() => {
        events = new EventTarget()
        frames = []
        vi.spyOn(window, 'addEventListener').mockImplementation(
          (type, listener, options) =>
            events.addEventListener(type, listener, options)
        )
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) =>
          frames.push(frame)
        )
        ChangeTracker.init()
      })

      it.for([
        { key: 'y', shiftKey: false, queue: 'redoQueue' },
        { key: 'z', shiftKey: true, queue: 'redoQueue' },
        { key: 'z', shiftKey: false, queue: 'undoQueue' }
      ] as const)(
        'Ctrl+$key shift=$shiftKey restores history when released before the next frame',
        async ({ key, shiftKey, queue }) => {
          const tracker = createTracker(createState(1))
          const target = createState(2)
          tracker[queue].push(target)
          mockCanvasState(createState(3))

          events.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true })
          )
          await Promise.all(frames.splice(0).map((frame) => frame(0)))
          events.dispatchEvent(
            new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey })
          )
          events.dispatchEvent(
            new KeyboardEvent('keyup', { key, ctrlKey: true, shiftKey })
          )
          events.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
          await Promise.all(frames.splice(0).map((frame) => frame(0)))

          expect(tracker.activeState).toEqual(target)
        }
      )

      it('captures changes when a bare modifier is released within one frame', () => {
        const tracker = createTracker(createState(1))
        const changed = createState(2)
        mockCanvasState(changed)

        events.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true })
        )
        events.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))

        expect(tracker.activeState).toEqual(changed)
      })
    })

    it.for([
      { editor: 'INPUT', createElement: () => document.createElement('input') },
      {
        editor: 'TEXTAREA',
        createElement: () => document.createElement('textarea')
      },
      {
        editor: 'contenteditable',
        createElement: () => {
          const element = document.createElement('div')
          Object.defineProperty(element, 'isContentEditable', { value: true })
          return element
        }
      }
    ])(
      'leaves $editor history to the editor without scanning modals',
      ({ createElement }) => {
        vi.spyOn(document, 'activeElement', 'get').mockReturnValue(
          createElement()
        )
        useQueueSettingsStore().mode = 'disabled'
        const querySelectorAll = vi.spyOn(document, 'querySelectorAll')
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) =>
          frames.push(frame)
        )
        const addEventListener = vi
          .spyOn(window, 'addEventListener')
          .mockImplementation(() => {})
        ChangeTracker.init()
        const keydown = addEventListener.mock.calls.find(
          ([type]) => type === 'keydown'
        )?.[1]
        if (typeof keydown !== 'function')
          throw new Error('keydown listener missing')

        keydown(new KeyboardEvent('keydown', { key: 'a' }))

        expect(querySelectorAll).not.toHaveBeenCalled()
        expect(frames).toHaveLength(0)
      }
    )

    it('captures editor changes when store-backed auto-queue uses change mode', async () => {
      const editor = document.createElement('input')
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(editor)
      useQueueSettingsStore().mode = 'change'
      app.ui.autoQueueEnabled = false
      const tracker = createTracker(createState(1))
      mockCanvasState(createState(2))
      const frames: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) =>
        frames.push(frame)
      )
      const addEventListener = vi
        .spyOn(window, 'addEventListener')
        .mockImplementation(() => {})
      ChangeTracker.init()
      const keydown = addEventListener.mock.calls.find(
        ([type]) => type === 'keydown'
      )?.[1]
      if (typeof keydown !== 'function')
        throw new Error('keydown listener missing')

      keydown(new KeyboardEvent('keydown', { key: 'a' }))
      expect(frames).toHaveLength(1)
      await frames[0](0)

      expect(dispatchedEventNames()).toContain('autoQueueGraphChanged')
      expect(tracker.activeState.nodes).toHaveLength(2)
    })
  })

  describe('captureCanvasState', () => {
    describe('guards', () => {
      it('is a no-op when the workflow owns no graph', () => {
        const tracker = createTracker()
        const original = tracker.activeState
        tracker.workflow.graph = null

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
        expect(tracker.activeState).toBe(original)
      })

      it('snapshots the workflow graph even while another graph is on the canvas', () => {
        const tracker = createTracker(createState(1))
        const ownState = createState(2)
        const ownGraph = new LGraph()
        vi.spyOn(ownGraph, 'serialize').mockReturnValue(ownState as never)
        tracker.workflow.graph = markRaw(ownGraph)
        mockCanvasState(createState(3))

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
        expect(tracker.activeState).toEqual(ownState)
        expect(tracker.undoQueue).toHaveLength(1)
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
        useWorkflowStore().activeWorkflow = fromPartial({
          changeTracker: {}
        })

        tracker.captureCanvasState()

        expect(app.rootGraph.serialize).not.toHaveBeenCalled()
        expect(mockAssert).toHaveBeenCalledWith(
          false,
          'ChangeTracker.captureCanvasState() called on inactive tracker'
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
            useWorkflowStore().activeWorkflow = fromPartial({
              changeTracker: {}
            })
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

      it('does not push when only the recomputed node execution order differs', () => {
        const initial = createState(2)
        const tracker = createTracker(initial)
        const reordered = structuredClone(initial)
        reordered.nodes[0].order = 1
        reordered.nodes[1].order = 0
        mockCanvasState(reordered)

        tracker.captureCanvasState()

        expect(tracker.undoQueue).toHaveLength(0)
        expect(api.dispatchCustomEvent).not.toHaveBeenCalledWith(
          'graphChanged',
          expect.anything()
        )
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
        parent.definitions = { subgraphs: [leaf] }
        const initialLeaf = findSubgraphDefinition(initial, leafId)
        if (!initialLeaf) throw new Error('nested leaf definition missing')
        const initialLeafNode = initialLeaf.nodes[0]
        initialLeafNode.widgets_values = [1]
        const tracker = createTracker(initial)

        const changed = structuredClone(initial)
        const changedLeaf = findSubgraphDefinition(changed, leafId)
        if (!changedLeaf) throw new Error('nested leaf definition missing')
        const changedLeafNode = changedLeaf.nodes[0]
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
    it('keeps Redo after Undo normalizes an interior node size', async () => {
      const initial = await createSubgraphState()
      const changed = structuredClone(initial)
      getSubgraphDefinition(changed).nodes[0].widgets_values = [2]
      const normalized = structuredClone(initial)
      getSubgraphDefinition(normalized).nodes[0].size = [100, 178]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(normalized)
        mockCanvasState(normalized)
        return true
      })

      await tracker.undo()
      tracker.captureCanvasState()

      expect(tracker.undoQueue).toEqual([])
      expect(tracker.redoQueue).toEqual([changed])
      expect(tracker.activeState).toEqual(normalized)
      await tracker.redo()
      expect(tracker.activeState).toEqual(changed)
      expect(tracker.undoQueue).toEqual([normalized])
      expect(tracker.redoQueue).toEqual([])
    })

    it('clears Redo for an intentional resize after normalized Undo', async () => {
      const initial = createState(1)
      const changed = structuredClone(initial)
      changed.nodes[0].widgets_values = [2]
      const normalized = structuredClone(initial)
      normalized.nodes[0].size = [100, 178]
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(normalized)
        mockCanvasState(normalized)
        return true
      })
      await tracker.undo()
      const resized = structuredClone(normalized)
      resized.nodes[0].size = [350, 220]
      mockCanvasState(resized)

      tracker.captureCanvasState()

      expect(tracker.redoQueue).toEqual([])
      expect(tracker.undoQueue).toEqual([normalized])
      expect(tracker.activeState).toEqual(resized)
      await tracker.undo()
      expect(tracker.activeState).toEqual(normalized)
      await tracker.redo()
      expect(tracker.activeState).toEqual(resized)
    })

    it.for(['undo', 'redo'] as const)(
      'keeps the restored workflow snapshot when another graph is configured during %s',
      async (direction) => {
        const restored = createState(1)
        const changed = createState(2)
        const normalized = structuredClone(restored)
        normalized.nodes[0].size = [100, 178]
        const tracker = createTracker(changed)
        const history = { undo: tracker.undoQueue, redo: tracker.redoQueue }
        history[direction].push(restored)
        vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
          tracker.reset(normalized)
          mockCanvasState(createState(3))
          return true
        })

        await tracker[direction]()

        expect(tracker.activeState).toEqual(normalized)
        expect(tracker.initialState).toEqual(changed)
        expect(history[direction]).toEqual([])
      }
    )

    it('keeps the normalized snapshot if another workflow becomes active during Undo', async () => {
      const initial = createState(1)
      const tracker = createTracker(createState(2))
      tracker.undoQueue.push(initial)
      const normalized = structuredClone(initial)
      normalized.nodes[0].size = [100, 178]
      const otherState = createState(3)
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(normalized)
        createTracker(otherState)
        mockCanvasState(otherState)
        return true
      })

      await tracker.undo()

      expect(tracker.activeState).toEqual(normalized)
      expect(
        useWorkflowStore().activeWorkflow?.changeTracker.activeState
      ).toEqual(otherState)
    })

    it('keeps Redo reachable when a load rejects after committing the normalized Undo state', async () => {
      const saved = createState(1)
      saved.nodes[0].widgets_values = [1]
      const changed = structuredClone(saved)
      changed.nodes[0].widgets_values = [2]
      const normalized = structuredClone(saved)
      normalized.nodes[0].size = [100, 178]
      const tracker = createTracker(saved)
      tracker.activeState = changed
      tracker.undoQueue.push(saved)
      const workflow = useWorkflowStore().activeWorkflow
      assert.exists(workflow)
      workflow.isModified = true
      vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(workflow)
      const error = new Error('Post-load asset scan rejected')
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(normalized)
        mockCanvasState(normalized)
        throw error
      })

      await expect(tracker.undo()).rejects.toThrow(error)

      expect(tracker.activeState).toEqual(normalized)
      expect(tracker.initialState).toEqual(normalized)
      expect(tracker.undoQueue).toEqual([])
      expect(tracker.redoQueue).toEqual([changed])
      expect(workflow.isModified).toBe(false)
      expect(tracker._restoringState).toBe(false)
      await tracker.redo()
      expect(tracker.activeState).toEqual(changed)
      expect(workflow.isModified).toBe(true)
    })

    it('retains the Undo target when a same-workflow reload updates the tracker instead', async () => {
      const saved = createState(1)
      saved.nodes[0].widgets_values = [1]
      const current = structuredClone(saved)
      current.nodes[0].widgets_values = [2]
      const reloaded = structuredClone(current)
      reloaded.nodes[0].size = [100, 178]
      const tracker = createTracker(saved)
      tracker.activeState = current
      tracker.undoQueue.push(saved)
      const workflow = useWorkflowStore().activeWorkflow
      assert.exists(workflow)
      workflow.isModified = true
      vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(workflow)
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(reloaded)
        mockCanvasState(reloaded)
        return undefined
      })

      await tracker.undo()

      expect(tracker.activeState).toEqual(reloaded)
      expect(tracker.initialState).toEqual(saved)
      expect(tracker.undoQueue).toEqual([saved])
      expect(tracker.redoQueue).toEqual([])
      expect(workflow.isModified).toBe(true)
      expect(tracker._restoringState).toBe(false)
    })

    it('keeps Redo when a late load error follows normalization of an interior node size', async () => {
      const saved = await createSubgraphState()
      const changed = structuredClone(saved)
      getSubgraphDefinition(changed).nodes[0].widgets_values = [2]
      const normalized = structuredClone(saved)
      getSubgraphDefinition(normalized).nodes[0].size = [100, 178]
      const tracker = createTracker(saved)
      tracker.activeState = changed
      tracker.undoQueue.push(saved)
      const error = new Error('Post-load asset scan rejected')
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(normalized)
        mockCanvasState(normalized)
        throw error
      })

      await expect(tracker.undo()).rejects.toThrow(error)

      expect(tracker.activeState).toEqual(normalized)
      expect(tracker.initialState).toEqual(normalized)
      expect(tracker.undoQueue).toEqual([])
      expect(tracker.redoQueue).toEqual([changed])
      expect(tracker._restoringState).toBe(false)
    })

    it('retains the Undo target when an unrelated same-workflow reload precedes a late error', async () => {
      const saved = createState(1)
      saved.nodes[0].widgets_values = [1]
      const current = structuredClone(saved)
      current.nodes[0].widgets_values = [2]
      const reloaded = structuredClone(current)
      reloaded.nodes[0].size = [100, 178]
      const tracker = createTracker(saved)
      tracker.activeState = current
      tracker.undoQueue.push(saved)
      const workflow = useWorkflowStore().activeWorkflow
      assert.exists(workflow)
      workflow.isModified = true
      vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(workflow)
      const error = new Error('Superseded Undo asset scan rejected')
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(reloaded)
        mockCanvasState(reloaded)
        throw error
      })

      await expect(tracker.undo()).rejects.toThrow(error)

      expect(tracker.activeState).toEqual(reloaded)
      expect(tracker.initialState).toEqual(saved)
      expect(tracker.undoQueue).toEqual([saved])
      expect(tracker.redoQueue).toEqual([])
      expect(workflow.isModified).toBe(true)
      expect(tracker._restoringState).toBe(false)
    })

    it('retains a resize Undo target when an unrelated reload changes only the node size', async () => {
      const saved = createState(1)
      const current = structuredClone(saved)
      current.nodes[0].size = [400, 220]
      const reloaded = structuredClone(current)
      reloaded.nodes[0].size = [400, 260]
      const tracker = createTracker(saved)
      tracker.activeState = current
      tracker.undoQueue.push(saved)
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        tracker.reset(reloaded)
        mockCanvasState(reloaded)
        return undefined
      })

      await tracker.undo()

      expect(tracker.activeState).toEqual(reloaded)
      expect(tracker.initialState).toEqual(saved)
      expect(tracker.undoQueue).toEqual([saved])
      expect(tracker.redoQueue).toEqual([])
      expect(tracker._restoringState).toBe(false)
    })

    it.for([
      { direction: 'undo', reverse: 'redo', start: 3, end: 1 },
      { direction: 'redo', reverse: 'undo', start: 1, end: 3 }
    ] as const)(
      'applies both overlapping $direction requests',
      async ({ direction, reverse, start, end }) => {
        vi.useFakeTimers()
        onTestFinished(() => {
          vi.useRealTimers()
        })
        const current = createState(start)
        const intermediate = createState(2)
        const final = createState(end)
        const tracker = createTracker(current)
        const history = { undo: tracker.undoQueue, redo: tracker.redoQueue }
        history[direction].push(final, intermediate)
        const loadGraphData = vi
          .mocked(app.loadGraphData)
          .getMockImplementation()
        assert.exists(loadGraphData)
        vi.mocked(app.loadGraphData).mockImplementationOnce(async (...args) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 5))
          return loadGraphData(...args)
        })

        const requests = Promise.all([
          tracker[direction](),
          tracker[direction]()
        ])
        await vi.advanceTimersByTimeAsync(5)
        await requests

        expect(tracker.activeState).toEqual(final)
        expect(history[direction]).toEqual([])
        expect(history[reverse]).toEqual([current, intermediate])
        expect(tracker._restoringState).toBe(false)
      }
    )

    it.for([
      { first: 'undo', second: 'redo' },
      { first: 'redo', second: 'undo' }
    ] as const)(
      'applies overlapping $first then $second requests in order',
      async ({ first, second }) => {
        vi.useFakeTimers()
        onTestFinished(() => {
          vi.useRealTimers()
        })
        const current = createState(3)
        const previous = createState(2)
        const tracker = createTracker(current)
        const history = { undo: tracker.undoQueue, redo: tracker.redoQueue }
        history[first].push(previous)
        const loadGraphData = vi
          .mocked(app.loadGraphData)
          .getMockImplementation()
        assert.exists(loadGraphData)
        vi.mocked(app.loadGraphData).mockImplementationOnce(async (...args) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 5))
          return loadGraphData(...args)
        })

        const requests = Promise.all([tracker[first](), tracker[second]()])
        await vi.advanceTimersByTimeAsync(5)
        await requests

        expect(tracker.activeState).toEqual(current)
        expect(history[first]).toEqual([previous])
        expect(history[second]).toEqual([])
        expect(tracker._restoringState).toBe(false)
      }
    )

    it.for([false, undefined])(
      'processes a queued Undo after the pending restore returns %s',
      async (result) => {
        vi.useFakeTimers()
        onTestFinished(() => {
          vi.useRealTimers()
        })
        const earlier = createState(1)
        const previous = createState(2)
        const current = createState(3)
        const tracker = createTracker(current)
        tracker.undoQueue.push(earlier, previous)
        vi.mocked(app.loadGraphData).mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(() => resolve(result), 5))
        )

        const requests = Promise.all([tracker.undo(), tracker.undo()])
        await vi.advanceTimersByTimeAsync(0)
        expect(tracker.activeState).toEqual(current)
        expect(tracker.undoQueue).toEqual([earlier])
        expect(tracker.redoQueue).toEqual([])
        await vi.advanceTimersByTimeAsync(5)
        await requests

        expect(tracker.activeState).toEqual(previous)
        expect(tracker.undoQueue).toEqual([earlier])
        expect(tracker.redoQueue).toEqual([current])
        expect(tracker._restoringState).toBe(false)
      }
    )

    it.for([
      { direction: 'undo', reverse: 'redo' },
      { direction: 'redo', reverse: 'undo' }
    ] as const)(
      'processes a queued $direction after the pending restore rejects',
      async ({ direction, reverse }) => {
        const current = createState(3)
        const previous = createState(2)
        const tracker = createTracker(current)
        const history = { undo: tracker.undoQueue, redo: tracker.redoQueue }
        history[direction].push(previous)
        const error = new Error('Workflow load rejected')
        vi.mocked(app.loadGraphData).mockRejectedValueOnce(error)

        const results = await Promise.allSettled([
          tracker[direction](),
          tracker[direction]()
        ])

        expect(results).toEqual([
          { status: 'rejected', reason: error },
          { status: 'fulfilled', value: undefined }
        ])
        expect(tracker.activeState).toEqual(previous)
        expect(history[direction]).toEqual([])
        expect(history[reverse]).toEqual([current])
        expect(tracker._restoringState).toBe(false)
      }
    )

    it('serializes distinct workflow requests after a pending Undo', async () => {
      vi.useFakeTimers()
      onTestFinished(() => {
        vi.useRealTimers()
      })
      const earlier = createState(1)
      const previous = createState(2)
      const current = createState(3)
      const firstSelection = createState(4)
      const secondSelection = createState(5)
      const firstSource = [firstSelection]
      const secondSource = [secondSelection]
      const tracker = createTracker(current)
      tracker.undoQueue.push(earlier, previous)
      let releasePending!: () => void
      const pending = new Promise<void>((resolve) => {
        releasePending = resolve
      })
      vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
        await pending
        tracker.reset(previous)
        mockCanvasState(previous)
        return true
      })

      const undo = tracker.undo()
      let selectionFinished = false
      const firstRequest = tracker
        .updateState(firstSource, tracker.undoQueue)
        .then(() => {
          selectionFinished = true
        })
      const secondRequest = tracker.updateState(secondSource, tracker.undoQueue)
      try {
        await vi.advanceTimersByTimeAsync(0)
        expect(selectionFinished).toBe(false)
      } finally {
        releasePending()
        await Promise.all([undo, firstRequest, secondRequest])
      }

      expect(tracker.activeState).toEqual(secondSelection)
      expect(tracker.undoQueue).toEqual([earlier, previous, firstSelection])
      expect(tracker.redoQueue).toEqual([current])
      expect(firstSource).toEqual([])
      expect(secondSource).toEqual([])
    })

    it.for([false, undefined])(
      'preserves state and history when restoration returns %s',
      async (result) => {
        const initial = createState(1)
        const current = createState(2)
        const tracker = createTracker(current)
        tracker.undoQueue.push(initial)
        vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
          expect(tracker.activeState).toEqual(current)
          mockCanvasState(createState(3))
          return result
        })

        await tracker.undo()

        expect(tracker.activeState).toEqual(current)
        expect(tracker.undoQueue).toEqual([initial])
        expect(tracker.redoQueue).toEqual([])
        expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
        expect(tracker._restoringState).toBe(false)
      }
    )

    it('preserves state and history when restoration rejects', async () => {
      const initial = createState(1)
      const current = createState(2)
      const tracker = createTracker(current)
      tracker.undoQueue.push(initial)
      const error = new Error('Workflow load rejected')
      vi.mocked(app.loadGraphData).mockRejectedValueOnce(error)

      await expect(tracker.undo()).rejects.toThrow(error)

      expect(tracker.activeState).toEqual(current)
      expect(tracker.undoQueue).toEqual([initial])
      expect(tracker.redoQueue).toEqual([])
      expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
      expect(tracker._restoringState).toBe(false)
    })

    it.for([
      {
        direction: 'undo',
        reverse: 'redo',
        restoresSaved: true,
        restoredValue: 1,
        modified: false
      },
      {
        direction: 'redo',
        reverse: 'undo',
        restoresSaved: true,
        restoredValue: 1,
        modified: false
      },
      {
        direction: 'undo',
        reverse: 'redo',
        restoresSaved: false,
        restoredValue: 3,
        modified: true
      }
    ] as const)(
      'tracks unsaved changes after $direction normalizes a node (saved target: $restoresSaved)',
      async ({ direction, reverse, restoredValue, modified }) => {
        const saved = createState(1)
        saved.nodes[0].widgets_values = [1]
        const current = structuredClone(saved)
        current.nodes[0].widgets_values = [2]
        const restored = structuredClone(saved)
        restored.nodes[0].widgets_values = [restoredValue]
        const normalized = structuredClone(restored)
        normalized.nodes[0].size = [100, 178]
        const tracker = createTracker(saved)
        tracker.activeState = current
        const workflow = useWorkflowStore().activeWorkflow
        assert.exists(workflow)
        vi.mocked(useWorkflowStore().getWorkflowByPath).mockReturnValue(
          workflow
        )
        const history = { undo: tracker.undoQueue, redo: tracker.redoQueue }
        history[direction].push(restored)
        vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
          tracker.reset(normalized)
          mockCanvasState(normalized)
          return true
        })

        await tracker[direction]()
        tracker.captureCanvasState()

        expect(workflow.isModified).toBe(modified)
        expect(tracker.activeState).toEqual(normalized)
        expect(history[direction]).toEqual([])
        expect(history[reverse]).toEqual([current])
        await tracker[reverse]()
        expect(tracker.activeState).toEqual(current)
        expect(workflow.isModified).toBe(true)
      }
    )

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
      expect(useNodeOutputStore().snapshotOutputs).toHaveBeenCalled()
      expect(useSubgraphNavigationStore().exportState).toHaveBeenCalled()
    })

    it('skips captureCanvasState but still calls store during undo/redo', () => {
      const tracker = createTracker(createState(1))
      tracker._restoringState = true

      tracker.deactivate()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(useNodeOutputStore().snapshotOutputs).toHaveBeenCalled()
    })

    it('is a full no-op and calls assert when called on inactive tracker', () => {
      const tracker = createTracker()
      useWorkflowStore().activeWorkflow = fromPartial({
        changeTracker: {}
      })

      tracker.deactivate()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(useNodeOutputStore().snapshotOutputs).not.toHaveBeenCalled()
      expect(mockAssert).toHaveBeenCalledWith(
        false,
        'ChangeTracker.deactivate() called on inactive tracker'
      )
    })
  })

  describe('restore', () => {
    function deactivateWithNavigation(navigation: string[]) {
      const tracker = createTracker(createState(1))
      vi.mocked(useSubgraphNavigationStore().exportState).mockReturnValue(
        navigation
      )
      tracker.deactivate()
      return tracker
    }

    it('reopens the deepest subgraph the undone state still contains', () => {
      const survivor = fromPartial<Subgraph>({ id: 'outer', nodes: [] })
      app.rootGraph.subgraphs.set('outer', survivor)
      const tracker = deactivateWithNavigation(['outer', 'inner', 'innermost'])
      let restoredNavigation: string[] | undefined
      vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
        (navigation) => {
          restoredNavigation = [...navigation]
        }
      )

      tracker.restore()

      expect(restoredNavigation).toEqual(['outer'])
      expect(app.canvas.setGraph).toHaveBeenCalledWith(survivor)
    })

    it('reopens the deepest of multiple surviving ancestors', () => {
      const outer = fromPartial<Subgraph>({ id: 'outer', nodes: [] })
      const inner = fromPartial<Subgraph>({ id: 'inner', nodes: [] })
      app.rootGraph.subgraphs.set('outer', outer)
      app.rootGraph.subgraphs.set('inner', inner)
      const tracker = deactivateWithNavigation(['outer', 'inner', 'innermost'])
      let restoredNavigation: string[] | undefined
      vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
        (navigation) => {
          restoredNavigation = [...navigation]
        }
      )

      tracker.restore()

      expect(restoredNavigation).toEqual(['outer', 'inner'])
      expect(app.canvas.setGraph).toHaveBeenCalledWith(inner)
    })

    it('returns to the root graph when the undone state removed every ancestor', () => {
      const tracker = deactivateWithNavigation(['outer', 'inner'])
      let restoredNavigation: string[] | undefined
      vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
        (navigation) => {
          restoredNavigation = [...navigation]
        }
      )

      tracker.restore()

      expect(restoredNavigation).toEqual([])
      expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
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
      useWorkflowStore().activeWorkflow = fromPartial({
        changeTracker: {}
      })

      tracker.prepareForSave()

      expect(app.rootGraph.serialize).not.toHaveBeenCalled()
      expect(tracker.activeState).toBe(original)
    })
  })

  describe('checkState (deprecated)', () => {
    it('captures each state and warns once across repeated calls', () => {
      const tracker = createTracker(createState(1))
      const firstChanged = createState(2)
      mockCanvasState(firstChanged)

      tracker.checkState()

      expect(tracker.activeState).toEqual(firstChanged)

      const secondChanged = createState(3)
      mockCanvasState(secondChanged)
      tracker.checkState()

      expect(tracker.activeState).toEqual(secondChanged)
      expect(
        vi
          .mocked(console.warn)
          .mock.calls.filter(
            ([message]) =>
              message ===
              'checkState() is deprecated — use captureCanvasState() instead.'
          )
      ).toHaveLength(1)
    })
  })

  describe('node-history widgets', () => {
    const addedNodes: LGraphNode[] = []

    afterEach(() => {
      for (const node of addedNodes.splice(0)) app.rootGraph.remove(node)
    })

    const regionA = { x: 0, y: 0, width: 64, height: 64 }
    const regionB = { x: 32, y: 32, width: 128, height: 128 }

    function addBoundingBoxesNode() {
      const node = new LGraphNode('CreateBoundingBoxes')
      node.id = toNodeId(7)
      node.addWidget('number', 'width', 512, null)
      node.addWidget('boundingboxes', 'bboxes', [], null)
      const nodes = vi.spyOn(app.rootGraph, 'nodes', 'get')
      nodes.mockReturnValue([node])
      onTestFinished(() => nodes.mockRestore())
      return { id: node.id, removeFromGraph: () => nodes.mockReturnValue([]) }
    }

    function recordNodeHistory(nodeId: LGraphNode['id']) {
      const scope = {
        rootGraphId: app.rootGraph.id,
        widgetId: widgetId(app.rootGraph.id, nodeId, 'bboxes')
      }
      useWidgetHistoryStore().record(scope, [])
      return () => useWidgetHistoryStore().canUndo(scope)
    }

    function stateWith(
      nodeId: LGraphNode['id'],
      values: { width: number; bboxes: unknown[] },
      pos: [number, number] = [0, 0]
    ): ComfyWorkflowJSON {
      const state = createState()
      state.nodes = [
        {
          id: nodeId,
          type: 'CreateBoundingBoxes',
          pos,
          size: [100, 50],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [],
          outputs: [],
          properties: {},
          widgets_values: [values.width, values.bboxes],
          widgets_values_named: { ...values }
        }
      ]
      return state
    }

    function loadedState(): unknown {
      return vi.mocked(app.loadGraphData).mock.calls.at(-1)?.[0]
    }

    function addImageCropNode() {
      const node = new LGraphNode('ImageCropV2')
      node.id = toNodeId(8)
      node.serialize_widgets = true
      app.rootGraph.add(node)
      addedNodes.push(node)
      vi.mocked(app.rootGraph.serialize).mockRestore()
      const crop = useBoundingBoxWidget()(node, {
        type: 'BOUNDING_BOX',
        name: 'crop_region',
        component: 'ImageCrop'
      })
      const field = (name: string) => {
        const widget = node.widgets?.find((w) => w.name === name)
        if (!widget) throw new Error(`missing widget ${name}`)
        return widget
      }
      const cropBounds = () => {
        if (!isBoundsObject(crop.value)) throw new Error('crop is not bounds')
        return crop.value
      }
      return { crop, cropBounds, field }
    }

    function inVueNodesMode(enabled: boolean) {
      const previous = LiteGraph.vueNodesMode
      LiteGraph.vueNodesMode = enabled
      onTestFinished(() => {
        LiteGraph.vueNodesMode = previous
      })
    }

    async function serializedGraph() {
      return requireValidWorkflow(app.rootGraph.serialize())
    }

    it('keeps an image crop edit and its widget undo out of graph history in Vue nodes mode', async () => {
      inVueNodesMode(true)
      const { crop, cropBounds, field } = addImageCropNode()
      const tracker = createTracker(await serializedGraph())
      const editCrop = (x: number) => {
        crop.value = { ...cropBounds(), x }
        crop.callback?.(crop.value)
        tracker.captureCanvasState()
      }

      editCrop(25)
      expect(field('x').value).toBe(25)
      editCrop(0)

      expect(tracker.undoQueue).toEqual([])
    })

    it('records a graph undo step for a crop field edited on the classic canvas', async () => {
      inVueNodesMode(false)
      const { cropBounds, field } = addImageCropNode()
      const tracker = createTracker(await serializedGraph())

      field('x').callback?.(25)
      tracker.captureCanvasState()

      expect(cropBounds().x).toBe(25)
      expect(tracker.undoQueue).toHaveLength(1)
    })

    it('records no graph undo step for a node-history value edit', () => {
      const { id } = addBoundingBoxesNode()
      const initial = stateWith(id, { width: 512, bboxes: [] })
      const edited = stateWith(id, { width: 512, bboxes: [regionA] })
      const tracker = createTracker(initial)
      mockCanvasState(edited)

      tracker.captureCanvasState()

      expect(tracker.undoQueue).toEqual([])
      expect(tracker.activeState).toEqual(edited)
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith(
        'graphChanged',
        edited
      )
    })

    it('keeps the live node-history value when undoing another change', async () => {
      const { id } = addBoundingBoxesNode()
      const initial = stateWith(id, { width: 512, bboxes: [] })
      const moved = stateWith(id, { width: 512, bboxes: [] }, [50, 50])
      const movedAndEdited = stateWith(
        id,
        { width: 512, bboxes: [regionA] },
        [50, 50]
      )
      const tracker = createTracker(initial)
      mockCanvasState(moved)
      tracker.captureCanvasState()
      mockCanvasState(movedAndEdited)
      tracker.captureCanvasState()

      await tracker.undo()

      expect(loadedState()).toEqual(
        stateWith(id, { width: 512, bboxes: [regionA] })
      )
      expect(tracker.redoQueue).toEqual([movedAndEdited])
    })

    it('preserves live values and prunes only the restored background workflow histories', async () => {
      const { id } = addBoundingBoxesNode()
      const visibleHistory = recordNodeHistory(id)
      const visible = stateWith(id, { width: 512, bboxes: [regionB] })
      const activeTracker = createTracker(visible)
      mockCanvasState(visible)
      const graph = new LGraph()
      const node = new LGraphNode('CreateBoundingBoxes')
      node.id = id
      node.serialize_widgets = true
      node.pos = [50, 50]
      const backgroundRegion = {
        ...regionA,
        metadata: { type: 'obj', text: '', desc: '', palette: [] }
      } satisfies BoundingBox
      node.addWidget('number', 'width', 512, null)
      node.addWidget('boundingboxes', 'bboxes', [backgroundRegion], null)
      graph.add(node)
      const initial = stateWith(id, { width: 512, bboxes: [] })
      const current = stateWith(
        id,
        { width: 512, bboxes: [backgroundRegion] },
        [50, 50]
      )
      const tracker = new ChangeTracker(
        fromPartial({ path: '/test/background.json', graph }),
        current
      )
      tracker.undoQueue.push(initial)
      const liveScope = {
        rootGraphId: graph.id,
        widgetId: widgetId(graph.id, id, 'bboxes')
      }
      const removedScope = {
        rootGraphId: graph.id,
        widgetId: widgetId(graph.id, toNodeId(99), 'bboxes')
      }
      const histories = useWidgetHistoryStore()
      histories.record(liveScope, [])
      histories.record(removedScope, [])
      vi.mocked(app.loadGraphData).mockImplementationOnce(async (state) => {
        assert.exists(state)
        tracker.reset(state)
        return true
      })
      vi.mocked(api.dispatchCustomEvent).mockClear()

      await tracker.undo()

      expect(dispatchedEventNames()).not.toContain('graphChanged')
      expectAutoQueueGraphChangedNotDispatched()
      expect(tracker.activeState).toEqual(
        stateWith(id, { width: 512, bboxes: [backgroundRegion] })
      )
      expect([
        histories.canUndo(liveScope),
        histories.canUndo(removedScope),
        visibleHistory()
      ]).toEqual([true, false, true])
      expect(activeTracker.activeState).toEqual(visible)
    })

    it('forgets the node history of a deleted node', () => {
      const { id, removeFromGraph } = addBoundingBoxesNode()
      const hasHistory = recordNodeHistory(id)
      const tracker = createTracker(stateWith(id, { width: 512, bboxes: [] }))
      removeFromGraph()
      mockCanvasState(createState())

      tracker.captureCanvasState()

      expect(hasHistory()).toBe(false)
    })

    it('keeps the node history when graph undo reloads the node', async () => {
      const { id } = addBoundingBoxesNode()
      const hasHistory = recordNodeHistory(id)
      const tracker = createTracker(stateWith(id, { width: 512, bboxes: [] }))
      mockCanvasState(stateWith(id, { width: 512, bboxes: [] }, [50, 50]))
      tracker.captureCanvasState()

      await tracker.undo()

      expect(tracker.redoQueue).toHaveLength(1)
      expect(hasHistory()).toBe(true)
    })

    it('keeps graph redo through a node-history edit and redoes with the live value', async () => {
      const { id } = addBoundingBoxesNode()
      const initial = stateWith(id, { width: 512, bboxes: [] })
      const moved = stateWith(id, { width: 512, bboxes: [] }, [50, 50])
      const tracker = createTracker(initial)
      mockCanvasState(moved)
      tracker.captureCanvasState()
      await tracker.undo()
      mockCanvasState(stateWith(id, { width: 512, bboxes: [regionA] }))

      tracker.captureCanvasState()
      await tracker.redo()

      expect(loadedState()).toEqual(
        stateWith(id, { width: 512, bboxes: [regionA] }, [50, 50])
      )
    })

    it('restores the node-history value together with its node widgets', async () => {
      const { id } = addBoundingBoxesNode()
      const initial = stateWith(id, { width: 512, bboxes: [regionA] })
      const resized = stateWith(id, { width: 1024, bboxes: [regionB] })
      const tracker = createTracker(initial)
      mockCanvasState(resized)
      tracker.captureCanvasState()

      await tracker.undo()

      expect(loadedState()).toEqual(initial)
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

    it.for<[string, () => HTMLElement]>([
      ['a reka dialog', createRekaDialog],
      ['a native dialog', createNativeDialog],
      ['a legacy comfy modal', createLegacyComfyModal]
    ])('does not undo while %s is open', async ([, createModal]) => {
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
