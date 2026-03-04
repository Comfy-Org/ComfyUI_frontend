import { createTestingPinia } from '@pinia/testing'
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

const mockEmptyWorkflowDialog = vi.hoisted(() => ({
  show: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {}, nodes: [{ id: 1 }] }
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

import { useAppModeStore } from './appModeStore'

function createBuilderWorkflow(
  activeMode: string = 'builder:select'
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

describe('appModeStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.mocked(app.rootGraph).extra = {}
    mockResolveNode.mockReturnValue(undefined)
    vi.mocked(app.rootGraph).nodes = [{ id: 1 } as LGraphNode]
  })

  describe('enterBuilder', () => {
    it('navigates to builder:arrange when in app mode with outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      const store = useAppModeStore()
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
    })

    it('navigates to builder:select when in app mode without outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      const store = useAppModeStore()

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('navigates to builder:select when in graph mode with outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('navigates to builder:select when in graph mode without outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('shows empty workflow dialog when graph has no nodes', () => {
      vi.mocked(app.rootGraph).nodes = []

      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()
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
    function getDialogOptions() {
      vi.mocked(app.rootGraph).nodes = []

      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()
      store.enterBuilder()

      return mockEmptyWorkflowDialog.show.mock.calls[0][0]
    }

    it('onDismiss sets graph mode', () => {
      const options = getDialogOptions()
      options.onDismiss()

      const workflowStore = useWorkflowStore()
      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })

    it('onEnterBuilder enters builder when nodes exist', () => {
      const options = getDialogOptions()

      // Simulate template having loaded nodes
      vi.mocked(app.rootGraph).nodes = [{ id: 1 } as LGraphNode]

      options.onEnterBuilder()

      const workflowStore = useWorkflowStore()
      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('onEnterBuilder shows dialog again when no nodes', () => {
      const options = getDialogOptions()

      // Graph still empty
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
      workflow.changeTracker = createMockChangeTracker({
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
      } as unknown as Partial<ChangeTracker>)
      return workflow
    }

    it('removes inputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = workflowWithLinearData(
        [
          [1, 'prompt'],
          [99, 'width']
        ],
        []
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([[1, 'prompt']])
    })

    it('keeps inputs for existing nodes even if widget is missing', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = workflowWithLinearData(
        [
          [1, 'prompt'],
          [1, 'deleted_widget']
        ],
        []
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([
        [1, 'prompt'],
        [1, 'deleted_widget']
      ])
    })

    it('removes outputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = workflowWithLinearData([], [1, 99])
      await nextTick()

      expect(store.selectedOutputs).toEqual([1])
    })

    it('hasOutputs is false when all output nodes are deleted', async () => {
      mockResolveNode.mockReturnValue(undefined)

      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = workflowWithLinearData([], [10, 20])
      await nextTick()

      expect(store.selectedOutputs).toEqual([])
      expect(store.hasOutputs).toBe(false)
    })
  })

  describe('linearData sync watcher', () => {
    it('writes linearData to rootGraph.extra when in builder mode', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [1]
      })
    })

    it('does not write linearData when not in builder mode', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      const workflow = createBuilderWorkflow()
      workflow.activeMode = 'graph'
      workflowStore.activeWorkflow = workflow
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('does not write when rootGraph is null', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

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

    it('reflects input changes in linearData', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt']],
        outputs: []
      })
    })
  })
})
