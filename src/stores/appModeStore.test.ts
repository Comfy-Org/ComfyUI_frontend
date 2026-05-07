import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type { ChangeTracker } from '@/scripts/changeTracker'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

const mockEmptyWorkflowDialog = vi.hoisted(() => {
  let lastOptions: { onEnterBuilder: () => void; onDismiss: () => void }
  return {
    show: vi.fn((options: typeof lastOptions) => {
      lastOptions = options
    }),
    get lastOptions() {
      return lastOptions
    }
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {}, nodes: [{ id: 1 }], events: new EventTarget() }
  }
}))

const mockResolveNode = vi.hoisted(() =>
  vi.fn<(id: NodeId) => LGraphNode | undefined>(() => undefined)
)
vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveNode: mockResolveNode
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => mockEmptyWorkflowDialog
}))

const mockSettings = vi.hoisted(() => {
  const store: Record<string, unknown> = {}
  return {
    store,
    get: vi.fn((key: string) => store[key] ?? false),
    set: vi.fn(async (key: string, value: unknown) => {
      store[key] = value
    }),
    reset() {
      for (const key of Object.keys(store)) delete store[key]
    }
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettings
}))

import { useAppModeStore } from './appModeStore'

function createBuilderWorkflow(
  activeMode: string = 'builder:inputs'
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflowClass({
    path: 'workflows/test.json',
    modified: Date.now(),
    size: 100
  })
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  workflow.activeMode = activeMode as LoadedComfyWorkflow['activeMode']
  return workflow as LoadedComfyWorkflow
}

/**
 * Create a workflow with a persisted output so enterBuilder
 * routes to builder:arrange (requires node 1 to resolve).
 */
function createBuilderWorkflowWithOutputs(
  activeMode: string
): LoadedComfyWorkflow {
  mockResolveNode.mockReturnValue(fromAny({ id: 1 }))
  const workflow = createBuilderWorkflow(activeMode)
  workflow.changeTracker!.activeState!.extra ??= {}
  workflow.changeTracker.activeState.extra.linearData = {
    inputs: [],
    outputs: [1]
  }
  return workflow
}

describe('appModeStore', () => {
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let store: ReturnType<typeof useAppModeStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.mocked(app.rootGraph).extra = {}
    mockResolveNode.mockReturnValue(undefined)
    mockSettings.reset()
    vi.mocked(app.rootGraph).nodes = [{ id: 1 } as LGraphNode]
    workflowStore = useWorkflowStore()
    store = useAppModeStore()
    vi.clearAllMocks()
  })

  describe('enterBuilder', () => {
    it('navigates to builder:arrange when in app mode with outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflowWithOutputs('app')

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
    })

    it('navigates to builder:inputs when in app mode without outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('navigates to builder:inputs when in graph mode with outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('navigates to builder:inputs when in graph mode without outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('shows empty workflow dialog when graph has no nodes', () => {
      vi.mocked(app.rootGraph).nodes = []
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()

      expect(mockEmptyWorkflowDialog.show).toHaveBeenCalledWith(
        expect.objectContaining({
          onEnterBuilder: expect.any(Function),
          onDismiss: expect.any(Function)
        })
      )
      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })
  })

  describe('empty workflow dialog callbacks', () => {
    function getDialogOptions(nodes: LGraphNode[] = []) {
      vi.mocked(app.rootGraph).nodes = nodes
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      store.enterBuilder()
      return mockEmptyWorkflowDialog.lastOptions
    }

    it('onDismiss sets graph mode', () => {
      const options = getDialogOptions()

      // Move to builder so onDismiss must actually transition back
      workflowStore.activeWorkflow!.activeMode = 'builder:inputs'

      options.onDismiss()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })

    it('onEnterBuilder enters builder when nodes exist', () => {
      const options = getDialogOptions([{ id: 1 } as LGraphNode])

      options.onEnterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('onEnterBuilder shows dialog again when no nodes', () => {
      const options = getDialogOptions()

      mockEmptyWorkflowDialog.show.mockClear()
      options.onEnterBuilder()

      expect(mockEmptyWorkflowDialog.show).toHaveBeenCalled()
    })
  })

  describe('loadSelections pruning', () => {
    function mockNode(id: number) {
      return { id }
    }

    function workflowWithLinearData(
      inputs: [number, string][],
      outputs: number[]
    ) {
      const workflow = createBuilderWorkflow('app')
      workflow.changeTracker = createMockChangeTracker(
        fromPartial<Partial<ChangeTracker>>({
          activeState: {
            last_node_id: 0,
            last_link_id: 0,
            nodes: [],
            links: [],
            groups: [],
            config: {},
            version: 0.4,
            extra: { linearData: { inputs, outputs } }
          }
        })
      )
      return workflow
    }

    it('removes inputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )

      store.loadSelections({
        inputs: [
          [1, 'prompt'],
          [99, 'width']
        ]
      })

      expect(store.selectedInputs).toEqual([[1, 'prompt']])
    })

    it('preserves config through pruning', () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )

      store.loadSelections({
        inputs: [[1, 'prompt', { height: 150 }]]
      })

      expect(store.selectedInputs).toEqual([[1, 'prompt', { height: 150 }]])
    })

    it('keeps inputs for existing nodes even if widget is missing', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )

      store.loadSelections({
        inputs: [
          [1, 'prompt'],
          [1, 'deleted_widget']
        ]
      })

      expect(store.selectedInputs).toEqual([
        [1, 'prompt'],
        [1, 'deleted_widget']
      ])
    })

    it('removes outputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )

      store.loadSelections({ outputs: [1, 99] })

      expect(store.selectedOutputs).toEqual([1])
    })

    it('reloads selections on configured event', async () => {
      const node1 = mockNode(1)

      // Initially nodes are not resolvable — pruning removes them
      mockResolveNode.mockReturnValue(undefined)
      const inputs: [number, string][] = [[1, 'seed']]
      workflowStore.activeWorkflow = workflowWithLinearData(inputs, [1])
      store.loadSelections({ inputs })
      await nextTick()

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])

      // After graph configures, nodes become resolvable
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )
      ;(app.rootGraph.events as EventTarget).dispatchEvent(
        new Event('configured')
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([[1, 'seed']])
      expect(store.selectedOutputs).toEqual([1])
    })

    it('hasOutputs is false when all output nodes are deleted', async () => {
      mockResolveNode.mockReturnValue(undefined)

      store.loadSelections({ outputs: [10, 20] })

      expect(store.selectedOutputs).toEqual([])
      expect(store.hasOutputs).toBe(false)
    })
  })

  describe('linearData sync watcher', () => {
    it('writes linearData to rootGraph.extra when in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [1],
        layout: { panelRows: [] }
      })
    })

    it('does not write linearData when not in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('does not write when rootGraph is null', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      const originalRootGraph = app.rootGraph
      Object.defineProperty(app, 'rootGraph', { value: null, writable: true })

      store.selectedOutputs.push(1)
      await nextTick()

      Object.defineProperty(app, 'rootGraph', {
        value: originalRootGraph,
        writable: true
      })
    })

    it('calls captureCanvasState when input is selected', async () => {
      const workflow = createBuilderWorkflow()
      workflowStore.activeWorkflow = workflow
      await nextTick()
      vi.mocked(workflow.changeTracker!.captureCanvasState).mockClear()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(workflow.changeTracker!.captureCanvasState).toHaveBeenCalled()
    })

    it('calls captureCanvasState when input is deselected', async () => {
      const workflow = createBuilderWorkflow()
      workflowStore.activeWorkflow = workflow
      store.selectedInputs.push([42, 'prompt'])
      await nextTick()
      vi.mocked(workflow.changeTracker!.captureCanvasState).mockClear()

      store.selectedInputs.splice(0, 1)
      await nextTick()

      expect(workflow.changeTracker!.captureCanvasState).toHaveBeenCalled()
    })

    it('reflects input changes in linearData', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt']],
        outputs: [],
        layout: { panelRows: [] }
      })
    })
  })

  describe('updateInputConfig', () => {
    it('sets config on an existing input', () => {
      store.selectedInputs.push([1, 'prompt'])

      store.updateInputConfig(1 as NodeId, 'prompt', { height: 200 })

      expect(store.selectedInputs[0][2]).toEqual({ height: 200 })
    })

    it('is a no-op when entry is not found', () => {
      store.selectedInputs.push([1, 'prompt'])

      store.updateInputConfig(99 as NodeId, 'prompt', { height: 200 })

      expect(store.selectedInputs[0][2]).toBeUndefined()
    })

    it('matches nodeId with loose equality', () => {
      store.selectedInputs.push(['1', 'prompt'])

      store.updateInputConfig(1 as NodeId, 'prompt', { height: 200 })

      expect(store.selectedInputs[0][2]).toEqual({ height: 200 })
    })

    it('triggers linearData sync watcher', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      store.updateInputConfig(42 as NodeId, 'prompt', { height: 300 })
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt', { height: 300 }]],
        outputs: [],
        layout: { panelRows: [] }
      })
    })
  })

  describe('autoEnableVueNodes', () => {
    it('enables Vue nodes when entering select mode with them disabled', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(mockSettings.set).toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        true
      )
    })

    it('does not enable Vue nodes when already enabled', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = true
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(mockSettings.set).not.toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        expect.anything()
      )
    })

    it('shows popup when Vue nodes are switched on and not dismissed', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      mockSettings.store['Comfy.AppBuilder.VueNodeSwitchDismissed'] = false
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(store.showVueNodeSwitchPopup).toBe(true)
    })

    it('does not show popup when previously dismissed', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      mockSettings.store['Comfy.AppBuilder.VueNodeSwitchDismissed'] = true
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(store.showVueNodeSwitchPopup).toBe(false)
    })

    it('does not enable Vue nodes when entering builder:arrange', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      workflowStore.activeWorkflow = createBuilderWorkflowWithOutputs('app')

      store.enterBuilder()
      await nextTick()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
      expect(mockSettings.set).not.toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        expect.anything()
      )
    })
  })

  describe('viewport', () => {
    // Realistic viewport rect for cursor-anchored zoom math.
    const RECT = { left: 0, top: 0, width: 1000, height: 800 }

    describe('zoomStep', () => {
      it('clamps to MIN_SCALE on extreme zoom-out', () => {
        store.viewportScale = 0.2
        // Repeated zoom-outs should bottom out, not go negative or to 0.
        for (let i = 0; i < 50; i++) store.zoomOut()
        expect(store.viewportScale).toBeCloseTo(0.1, 5)
      })

      it('clamps to MAX_SCALE on extreme zoom-in', () => {
        store.viewportScale = 4
        for (let i = 0; i < 50; i++) store.zoomIn()
        expect(store.viewportScale).toBeCloseTo(8, 5)
      })

      it('is a no-op when noZoomMode is on', () => {
        store.noZoomMode = true
        const before = store.viewportScale
        store.zoomIn()
        store.zoomOut()
        expect(store.viewportScale).toBe(before)
      })
    })

    describe('zoomAt (cursor-anchored)', () => {
      it('keeps the focal pixel under the cursor across a zoom step', () => {
        // Cursor is offset (200, 150) from rect center. Pixel at that
        // workspace location before zoom should remain at the same
        // client coords after zoom.
        const cx = RECT.width / 2 + 200
        const cy = RECT.height / 2 + 150
        const prevScale = store.viewportScale
        const prevX = store.viewportOffsetX
        const prevY = store.viewportOffsetY

        // Workspace coord under cursor before zoom:
        // cursorOffset / scale - viewportOffset / scale.
        const workspaceX = (cx - RECT.left - RECT.width / 2 - prevX) / prevScale
        const workspaceY = (cy - RECT.top - RECT.height / 2 - prevY) / prevScale

        store.zoomAt(cx, cy, -120, RECT)

        // Same workspace coord, mapped through the new scale + offset,
        // should land at the same client coords.
        const projectedX =
          workspaceX * store.viewportScale +
          RECT.left +
          RECT.width / 2 +
          store.viewportOffsetX
        const projectedY =
          workspaceY * store.viewportScale +
          RECT.top +
          RECT.height / 2 +
          store.viewportOffsetY

        expect(projectedX).toBeCloseTo(cx, 1)
        expect(projectedY).toBeCloseTo(cy, 1)
      })

      it('is a no-op when noZoomMode is on', () => {
        store.noZoomMode = true
        const before = {
          scale: store.viewportScale,
          x: store.viewportOffsetX,
          y: store.viewportOffsetY
        }
        store.zoomAt(500, 400, -120, RECT)
        expect(store.viewportScale).toBe(before.scale)
        expect(store.viewportOffsetX).toBe(before.x)
        expect(store.viewportOffsetY).toBe(before.y)
      })
    })

    describe('panBy', () => {
      it('accumulates offsets', () => {
        store.panBy(10, -20)
        store.panBy(5, 5)
        expect(store.viewportOffsetX).toBe(15)
        expect(store.viewportOffsetY).toBe(-15)
      })

      it('is a no-op when noZoomMode is on', () => {
        store.noZoomMode = true
        store.panBy(50, 50)
        expect(store.viewportOffsetX).toBe(0)
        expect(store.viewportOffsetY).toBe(0)
      })
    })

    describe('resetView', () => {
      it('zeros offsets and resets scale to 1 from any state', () => {
        store.viewportScale = 3
        store.viewportOffsetX = 200
        store.viewportOffsetY = -100
        store.resetView()
        expect(store.viewportScale).toBe(1)
        expect(store.viewportOffsetX).toBe(0)
        expect(store.viewportOffsetY).toBe(0)
      })
    })

    describe('toggleNoZoomMode', () => {
      it('enables noZoom and resets the viewport in one step', () => {
        store.viewportScale = 2.5
        store.viewportOffsetX = 100
        store.toggleNoZoomMode()
        expect(store.noZoomMode).toBe(true)
        expect(store.viewportScale).toBe(1)
        expect(store.viewportOffsetX).toBe(0)
      })

      it('toggles back off without re-resetting', () => {
        store.toggleNoZoomMode() // on, resets
        store.viewportScale = 2 // would be ignored while noZoomMode is on
        store.toggleNoZoomMode() // off
        expect(store.noZoomMode).toBe(false)
        // resetView only fires on the on-transition; turning off leaves
        // whatever scale was in place.
        expect(store.viewportScale).toBe(2)
      })
    })

    describe('flyTo', () => {
      it('is a no-op when noZoomMode is on', () => {
        store.noZoomMode = true
        const before = {
          scale: store.viewportScale,
          x: store.viewportOffsetX,
          y: store.viewportOffsetY
        }
        store.flyTo(
          { x: 500, y: 500, width: 100, height: 100 },
          { duration: 0, viewportWidth: 1000, viewportHeight: 800 }
        )
        expect(store.viewportScale).toBe(before.scale)
        expect(store.viewportOffsetX).toBe(before.x)
        expect(store.viewportOffsetY).toBe(before.y)
      })
    })
  })
})
