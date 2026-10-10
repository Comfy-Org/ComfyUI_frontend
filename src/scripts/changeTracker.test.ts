import { fromPartial } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
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
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/LGraph'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApi } from '@/scripts/api'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({
  assert: mockAssert
}))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
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
      it('is a no-op when the graph is not ready', () => {
        const tracker = createTracker()
        const original = tracker.activeState

        const spy = vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
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
      const survivor = fromPartial<Subgraph>({ id: 'outer' })
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
      const outer = fromPartial<Subgraph>({ id: 'outer' })
      const inner = fromPartial<Subgraph>({ id: 'inner' })
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
