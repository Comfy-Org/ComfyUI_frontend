import { fromPartial } from '@total-typescript/shoehorn'
import type { PartialDeep } from '@total-typescript/shoehorn'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CanvasPointerEvent,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock('@/base/assert', () => ({
  assert: mockAssert
}))

const mockNodeOutputStore = vi.hoisted(() => ({
  snapshotOutputs: vi.fn(() => ({})),
  restoreOutputs: vi.fn()
}))

const mockSubgraphNavigationStore = vi.hoisted(() => ({
  exportState: vi.fn((): string[] => []),
  restoreState: vi.fn()
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: null as { changeTracker: unknown } | null,
  getWorkflowByPath: vi.fn()
}))

const mockExecutionStore = vi.hoisted(() => ({
  queuedJobs: {} as Record<string, { workflow: { changeTracker: unknown } }>
}))

const mockMaskEditorIsOpened = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/scripts/app', () => ({
  app: {
    constructor: {
      maskeditor_is_opended: mockMaskEditorIsOpened
    },
    graph: {},
    ui: {
      autoQueueEnabled: false,
      autoQueueMode: 'instant'
    },
    rootGraph: {
      subgraphs: new Map(),
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
      ds: { scale: 1, offset: [0, 0] },
      setGraph: vi.fn()
    },
    loadGraphData: vi.fn()
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

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => mockExecutionStore)
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
    inputs: [],
    outputs: [],
    properties: {}
  }))
  return Object.assign(fromPartial<ComfyWorkflowJSON>({}), {
    nodes,
    links: [],
    groups: [],
    extra: {},
    config: {},
    version: 0.4,
    last_node_id: nodeIdCounter,
    last_link_id: 0
  })
}

function createTracker(initialState?: ComfyWorkflowJSON): ChangeTracker {
  const state = initialState ?? createState()
  const workflow = fromPartial<ComfyWorkflow>({ path: '/test/workflow.json' })
  const tracker = new ChangeTracker(workflow, state)
  mockWorkflowStore.activeWorkflow = { changeTracker: tracker }
  return tracker
}

function mockCanvasState(state: ComfyWorkflowJSON) {
  vi.mocked(app.rootGraph.serialize).mockReturnValue(state as ISerialisedGraph)
}

type ListenerMap = Record<string, EventListener[]>

function storeListener(
  listeners: ListenerMap,
  type: string,
  listener: EventListenerOrEventListenerObject
) {
  if (typeof listener === 'function') {
    listeners[type] ??= []
    listeners[type].push(listener)
  }
}

function dispatchStored(listeners: ListenerMap, type: string, event: Event) {
  for (const listener of listeners[type] ?? []) {
    listener(event)
  }
}

async function flushAsyncFrame() {
  await Promise.resolve()
  await Promise.resolve()
}

function getApiListener(name: string) {
  const call = vi
    .mocked(api.addEventListener)
    .mock.calls.find(([eventName]) => eventName === name)
  expect(call).toBeDefined()
  return call?.[1] as (event: CustomEvent<ExecutedWsMessage>) => void
}

describe('ChangeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nodeIdCounter = 0
    ChangeTracker.isLoadingGraph = false
    Reflect.set(ChangeTracker, '_checkStateWarned', false)
    mockWorkflowStore.activeWorkflow = null
    mockWorkflowStore.getWorkflowByPath.mockReturnValue(null)
    mockExecutionStore.queuedJobs = {}
    mockMaskEditorIsOpened.mockReturnValue(false)
    app.ui.autoQueueEnabled = false
    app.ui.autoQueueMode = 'instant'
    vi.mocked(app.canvas.setGraph).mockClear()
    vi.mocked(app.loadGraphData).mockResolvedValue(undefined)
    app.rootGraph.subgraphs.clear()
    app.canvas.ds.scale = 1
    app.canvas.ds.offset = [0, 0]
  })

  describe('reset', () => {
    it('updates initialState from activeState or an explicit state', () => {
      const tracker = createTracker(createState(1))
      const changed = createState(2)

      tracker.activeState = changed
      tracker.reset()

      expect(tracker.initialState).toEqual(changed)
      expect(tracker.initialState).not.toBe(changed)

      const explicit = createState(3)
      tracker.reset(explicit)

      expect(tracker.activeState).toEqual(explicit)
      expect(tracker.activeState).not.toBe(explicit)
      expect(tracker.initialState).toEqual(explicit)
    })

    it('does not reset while restoring state', () => {
      const tracker = createTracker(createState(1))
      const original = tracker.initialState
      tracker._restoringState = true

      tracker.reset(createState(2))

      expect(tracker.initialState).toBe(original)
    })
  })

  describe('restore', () => {
    it('restores viewport, outputs, and root graph navigation', () => {
      const tracker = createTracker()
      app.canvas.ds.scale = 2
      app.canvas.ds.offset = [10, 20]
      mockNodeOutputStore.snapshotOutputs.mockReturnValue({ 1: { images: [] } })
      mockSubgraphNavigationStore.exportState.mockReturnValue([])

      tracker.store()
      app.canvas.ds.scale = 1
      app.canvas.ds.offset = [0, 0]
      tracker.restore()

      expect(app.canvas.ds.scale).toBe(2)
      expect(app.canvas.ds.offset).toEqual([10, 20])
      expect(mockNodeOutputStore.restoreOutputs).toHaveBeenCalledWith({
        1: { images: [] }
      })
      expect(mockSubgraphNavigationStore.restoreState).toHaveBeenCalledWith([])
      expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
    })

    it('restores saved subgraph navigation when the subgraph exists', () => {
      const tracker = createTracker()
      const subgraph = fromPartial<Subgraph>({ id: 'subgraph-1' })
      app.rootGraph.subgraphs.set('subgraph-1', subgraph)
      mockSubgraphNavigationStore.exportState.mockReturnValue(['subgraph-1'])

      tracker.store()
      tracker.restore()

      expect(app.canvas.setGraph).toHaveBeenCalledWith(subgraph)
    })
  })

  describe('captureCanvasState', () => {
    describe('guards', () => {
      it('is a no-op when app.graph is falsy', () => {
        const tracker = createTracker()
        const original = tracker.activeState

        const spy = vi.spyOn(app, 'graph', 'get').mockReturnValue(undefined)
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

      it('reports inactive tracker calls only once for the same workflow', () => {
        const tracker = createTracker()
        tracker.workflow.path = '/test/dedupe-workflow.json'
        mockWorkflowStore.activeWorkflow = { changeTracker: {} }

        tracker.captureCanvasState()
        tracker.captureCanvasState()

        expect(mockAssert).toHaveBeenCalledOnce()
      })
    })

    describe('state capture', () => {
      it('sets the active state without pushing undo when none exists yet', () => {
        const tracker = createTracker(createState(1))
        const changed = createState(2)
        Reflect.set(tracker, 'activeState', undefined)
        mockCanvasState(changed)

        tracker.captureCanvasState()

        expect(tracker.activeState).toEqual(changed)
        expect(tracker.undoQueue).toHaveLength(0)
      })

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

      it('does not capture until the outer change transaction finishes', () => {
        const tracker = createTracker(createState(1))
        tracker.beforeChange()
        tracker.beforeChange()
        mockCanvasState(createState(2))

        tracker.afterChange()
        expect(app.rootGraph.serialize).not.toHaveBeenCalled()

        tracker.afterChange()
        expect(app.rootGraph.serialize).toHaveBeenCalledOnce()
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

  describe('updateModified', () => {
    it('updates workflow modified state when the store can find it', () => {
      const state = createState(1)
      const tracker = createTracker(state)
      const workflow = { isModified: true }
      mockWorkflowStore.getWorkflowByPath.mockReturnValue(workflow)

      tracker.updateModified()
      expect(workflow.isModified).toBe(false)

      tracker.activeState = createState(2)
      tracker.updateModified()
      expect(workflow.isModified).toBe(true)
    })
  })

  describe('undo and redo', () => {
    it('restores previous state and moves the current state to the target queue', async () => {
      const initial = createState(1)
      const changed = createState(2)
      const tracker = createTracker(changed)
      tracker.undoQueue.push(initial)

      await tracker.undo()

      expect(app.loadGraphData).toHaveBeenCalledWith(
        initial,
        false,
        false,
        tracker.workflow,
        {
          checkForRerouteMigration: false,
          silentAssetErrors: true
        }
      )
      expect(tracker.activeState).toBe(initial)
      expect(tracker.redoQueue).toEqual([changed])
      expect(tracker._restoringState).toBe(false)
    })

    it('clears restoring state when loading fails', async () => {
      const tracker = createTracker(createState(2))
      tracker.undoQueue.push(createState(1))
      vi.mocked(app.loadGraphData).mockRejectedValueOnce(
        new Error('load failed')
      )

      await expect(tracker.undo()).rejects.toThrow('load failed')

      expect(tracker._restoringState).toBe(false)
    })

    it('does nothing when no previous state exists', async () => {
      const tracker = createTracker(createState(1))

      await tracker.undo()

      expect(app.loadGraphData).not.toHaveBeenCalled()
    })

    it('handles keyboard undo and redo shortcuts', async () => {
      const tracker = createTracker()
      const undo = vi.spyOn(tracker, 'undo').mockResolvedValue()
      const redo = vi.spyOn(tracker, 'redo').mockResolvedValue()

      await expect(
        tracker.undoRedo(
          new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
        )
      ).resolves.toBe(true)
      await expect(
        tracker.undoRedo(
          new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            shiftKey: true
          })
        )
      ).resolves.toBe(true)
      await expect(
        tracker.undoRedo(
          new KeyboardEvent('keydown', { key: 'y', metaKey: true })
        )
      ).resolves.toBe(true)
      await expect(
        tracker.undoRedo(
          new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            altKey: true
          })
        )
      ).resolves.toBeUndefined()

      expect(undo).toHaveBeenCalledOnce()
      expect(redo).toHaveBeenCalledTimes(2)
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

    it('warns only once before delegating', () => {
      const tracker = createTracker(createState(1))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      tracker.checkState()
      tracker.checkState()

      expect(warn).toHaveBeenCalledOnce()
      warn.mockRestore()
    })
  })

  describe('bindInput', () => {
    it('returns false for missing canvas or body elements', () => {
      expect(ChangeTracker.bindInput(null)).toBe(false)
      expect(ChangeTracker.bindInput(document.createElement('canvas'))).toBe(
        false
      )
      expect(ChangeTracker.bindInput(document.body)).toBe(false)
    })

    it('captures state once when an input-like element changes', () => {
      const tracker = createTracker()
      const capture = vi.spyOn(tracker, 'captureCanvasState')
      const input = document.createElement('input')

      expect(ChangeTracker.bindInput(input)).toBe(true)
      input.dispatchEvent(new Event('change'))
      input.dispatchEvent(new Event('change'))

      expect(capture).toHaveBeenCalledOnce()
    })

    it('binds textarea-like elements that expose an input handler slot', () => {
      const tracker = createTracker()
      const capture = vi.spyOn(tracker, 'captureCanvasState')
      const element = document.createElement('div') as HTMLElement & {
        oninput: unknown
      }
      element.oninput = null

      expect(ChangeTracker.bindInput(element)).toBe(true)
      element.dispatchEvent(new Event('change'))

      expect(capture).toHaveBeenCalledOnce()
    })
  })

  describe('init', () => {
    let windowListeners: ListenerMap
    let documentListeners: ListenerMap
    let windowAddSpy: MockInstance
    let documentAddSpy: MockInstance
    let rafSpy: MockInstance
    let originalProcessMouseUp: typeof LGraphCanvas.prototype.processMouseUp
    let originalPrompt: typeof LGraphCanvas.prototype.prompt
    let originalClose: typeof LiteGraph.ContextMenu.prototype.close

    beforeEach(() => {
      windowListeners = {}
      documentListeners = {}
      originalProcessMouseUp = LGraphCanvas.prototype.processMouseUp
      originalPrompt = LGraphCanvas.prototype.prompt
      originalClose = LiteGraph.ContextMenu.prototype.close
      windowAddSpy = vi
        .spyOn(window, 'addEventListener')
        .mockImplementation((type, listener) => {
          storeListener(windowListeners, type, listener)
        })
      documentAddSpy = vi
        .spyOn(document, 'addEventListener')
        .mockImplementation((type, listener) => {
          storeListener(documentListeners, type, listener)
        })
      rafSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          callback(0)
          return 1
        })
    })

    afterEach(() => {
      LGraphCanvas.prototype.processMouseUp = originalProcessMouseUp
      LGraphCanvas.prototype.prompt = originalPrompt
      LiteGraph.ContextMenu.prototype.close = originalClose
      windowAddSpy.mockRestore()
      documentAddSpy.mockRestore()
      rafSpy.mockRestore()
    })

    it('captures changes from registered browser, graph, and API events', async () => {
      const processMouseUp = vi.fn(() => true)
      const prompt = vi.fn()
      const close = vi.fn(() => true)

      LGraphCanvas.prototype.processMouseUp = processMouseUp
      LGraphCanvas.prototype.prompt = prompt
      LiteGraph.ContextMenu.prototype.close = close

      ChangeTracker.init()
      const tracker = createTracker()
      const capture = vi.spyOn(tracker, 'captureCanvasState')

      dispatchStored(windowListeners, 'mouseup', new MouseEvent('mouseup'))
      getApiListener('promptQueued')(
        new CustomEvent('promptQueued', {
          detail: fromPartial<ExecutedWsMessage>({})
        })
      )
      getApiListener('graphCleared')(
        new CustomEvent('graphCleared', {
          detail: fromPartial<ExecutedWsMessage>({})
        })
      )
      dispatchStored(
        documentListeners,
        'litegraph:canvas',
        new CustomEvent('litegraph:canvas', {
          detail: { subType: 'before-change' }
        })
      )
      dispatchStored(
        documentListeners,
        'litegraph:canvas',
        new CustomEvent('litegraph:canvas', {
          detail: { subType: 'after-change' }
        })
      )

      expect(capture).toHaveBeenCalledTimes(4)

      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'Control' })
      )
      await flushAsyncFrame()
      dispatchStored(windowListeners, 'keyup', new KeyboardEvent('keyup'))

      expect(capture).toHaveBeenCalledTimes(5)

      const undoRedo = vi.spyOn(tracker, 'undoRedo').mockResolvedValue(true)
      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
      )
      await flushAsyncFrame()

      expect(undoRedo).toHaveBeenCalledOnce()
      expect(capture).toHaveBeenCalledTimes(5)

      undoRedo.mockResolvedValue(undefined)
      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'a' })
      )
      await flushAsyncFrame()

      expect(capture).toHaveBeenCalledTimes(6)

      const input = document.createElement('input')
      document.body.append(input)
      input.focus()
      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'b' })
      )
      await flushAsyncFrame()
      input.remove()

      expect(capture).toHaveBeenCalledTimes(6)

      mockMaskEditorIsOpened.mockReturnValue(true)
      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'c' })
      )
      await flushAsyncFrame()

      expect(capture).toHaveBeenCalledTimes(6)

      const canvas = {} as LGraphCanvas
      LGraphCanvas.prototype.processMouseUp.call(
        canvas,
        new MouseEvent('mouseup') as CanvasPointerEvent
      )

      expect(processMouseUp).toHaveBeenCalledOnce()
      expect(capture).toHaveBeenCalledTimes(7)

      const promptCallback = vi.fn()
      LGraphCanvas.prototype.prompt.call(
        canvas,
        'title',
        'value',
        promptCallback,
        new MouseEvent('mouseup') as CanvasPointerEvent
      )
      const extendedCallback = prompt.mock.calls[0]?.[2] as
        | ((value: string) => void)
        | undefined
      extendedCallback?.('updated')

      expect(promptCallback).toHaveBeenCalledWith('updated')
      expect(capture).toHaveBeenCalledTimes(8)

      LiteGraph.ContextMenu.prototype.close.call(
        {} as InstanceType<typeof LiteGraph.ContextMenu>,
        new MouseEvent('mouseup')
      )

      expect(close).toHaveBeenCalledOnce()
      expect(capture).toHaveBeenCalledTimes(9)
    })

    it('ignores repeat keydowns and missing active trackers', async () => {
      ChangeTracker.init()
      const tracker = createTracker()
      const capture = vi.spyOn(tracker, 'captureCanvasState')

      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'x', repeat: true })
      )
      await flushAsyncFrame()
      expect(capture).not.toHaveBeenCalled()

      mockWorkflowStore.activeWorkflow = null
      dispatchStored(
        windowListeners,
        'keydown',
        new KeyboardEvent('keydown', { key: 'x' })
      )
      await flushAsyncFrame()
      expect(capture).not.toHaveBeenCalled()
    })

    it('stores executed outputs for the workflow that owns the prompt', () => {
      ChangeTracker.init()
      const tracker = createTracker()
      const executed = getApiListener('executed')
      mockExecutionStore.queuedJobs = {
        promptA: { workflow: { changeTracker: tracker } }
      }

      executed(
        new CustomEvent('executed', {
          detail: fromPartial<ExecutedWsMessage>({
            prompt_id: 'promptA',
            node: '1',
            output: { images: ['first'] }
          } as PartialDeep<ExecutedWsMessage>)
        })
      )
      executed(
        new CustomEvent('executed', {
          detail: fromPartial<ExecutedWsMessage>({
            prompt_id: 'promptA',
            node: '1',
            merge: true,
            output: { images: ['second'], text: ['caption'] }
          } as PartialDeep<ExecutedWsMessage>)
        })
      )
      executed(
        new CustomEvent('executed', {
          detail: fromPartial<ExecutedWsMessage>({
            prompt_id: 'missing',
            node: '2',
            output: { images: ['ignored'] }
          } as PartialDeep<ExecutedWsMessage>)
        })
      )

      expect(tracker.nodeOutputs).toEqual({
        1: { images: ['first', 'second'], text: ['caption'] }
      })
    })

    it('replaces non-array executed outputs during merge updates', () => {
      ChangeTracker.init()
      const tracker = createTracker()
      const executed = getApiListener('executed')
      mockExecutionStore.queuedJobs = {
        promptA: { workflow: { changeTracker: tracker } }
      }

      executed(
        new CustomEvent('executed', {
          detail: fromPartial<ExecutedWsMessage>({
            prompt_id: 'promptA',
            node: '1',
            output: { value: 'old' }
          } as PartialDeep<ExecutedWsMessage>)
        })
      )
      executed(
        new CustomEvent('executed', {
          detail: fromPartial<ExecutedWsMessage>({
            prompt_id: 'promptA',
            node: '1',
            merge: true,
            output: { value: 'new' }
          } as PartialDeep<ExecutedWsMessage>)
        })
      )

      expect(tracker.nodeOutputs).toEqual({
        1: { value: 'new' }
      })
    })
  })

  describe('graphEqual', () => {
    it('compares workflow nodes as an unordered set and ignores extra.ds', () => {
      const first = createState(2)
      const second = fromPartial<ComfyWorkflowJSON>({
        ...createState(),
        nodes: [...first.nodes].reverse(),
        links: first.links,
        groups: first.groups,
        extra: { ds: { scale: 2 } }
      } as PartialDeep<ComfyWorkflowJSON>)

      expect(ChangeTracker.graphEqual(first, first)).toBe(true)
      expect(ChangeTracker.graphEqual(first, second)).toBe(true)
    })

    it('returns false for non-object values and meaningful graph differences', () => {
      const first = createState(1)
      const differentNodes = createState(2)
      const differentLinks = fromPartial<ComfyWorkflowJSON>({
        ...first,
        links: [[1, 1, 0, 2, 0, 'MODEL']]
      } as PartialDeep<ComfyWorkflowJSON>)

      expect(ChangeTracker.graphEqual(first, null)).toBe(false)
      expect(ChangeTracker.graphEqual(first, differentNodes)).toBe(false)
      expect(ChangeTracker.graphEqual(first, differentLinks)).toBe(false)
    })

    it('returns false for extra properties other than viewport state', () => {
      const first = createState()
      const second = fromPartial<ComfyWorkflowJSON>({
        ...first,
        extra: { custom: true }
      } as PartialDeep<ComfyWorkflowJSON>)

      expect(ChangeTracker.graphEqual(first, second)).toBe(false)
    })

    it.each([
      'floatingLinks',
      'reroutes',
      'groups',
      'definitions',
      'subgraphs'
    ] as const)('returns false when %s differs', (key) => {
      const first = createState()
      const second = fromPartial<ComfyWorkflowJSON>({
        ...first,
        [key]: [{ id: 1 }]
      } as PartialDeep<ComfyWorkflowJSON>)

      expect(ChangeTracker.graphEqual(first, second)).toBe(false)
    })
  })
})
