import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { LGraphNode as LiteGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type { ChangeTracker } from '@/scripts/changeTracker'
import { usePromotionStore } from '@/stores/promotionStore'
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
    rootGraph: {
      extra: {},
      nodes: [{ id: 1, isSubgraphNode: () => false }],
      events: new EventTarget(),
      getNodeById: () => undefined
    }
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
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    widgetStates: new Map(),
    setPositionOverride: vi.fn(),
    clearPositionOverride: vi.fn()
  })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
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

function createPromotedWidgetFixture(hostId: number): {
  graph: LGraph
  host: SubgraphNode
  promoted: PromotedWidgetView
} {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'value', type: '*' }]
  })
  const inner = new LiteGraphNode('Inner')
  const input = inner.addInput('value', '*')
  inner.addWidget('text', 'value', 'a', () => {})
  input.widget = { name: 'value' }
  subgraph.add(inner)
  subgraph.inputNode.slots[0].connect(input, inner)

  const host = createTestSubgraphNode(subgraph, { id: hostId })
  host._internalConfigureAfterSlots()
  host.graph!.add(host)

  usePromotionStore().setPromotions(host.rootGraph.id, host.id, [
    { sourceNodeId: String(inner.id), sourceWidgetName: 'value' }
  ])

  const promoted = host.widgets.find(isPromotedWidgetView)
  if (!promoted) throw new Error('Expected promoted widget view')

  return { graph: host.graph!, host, promoted }
}

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
    resetSubgraphFixtureState()
    vi.mocked(app.rootGraph).extra = {}
    mockResolveNode.mockReturnValue(undefined)
    mockSettings.reset()
    vi.mocked(app.rootGraph).nodes = [
      { id: 1, isSubgraphNode: () => false } as LGraphNode
    ]
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

    it('loadSelections rewrites legacy promoted tuples to host node id and storeName', async () => {
      const { graph, host, promoted } = createPromotedWidgetFixture(500)
      const { resolveNode: actualResolveNode } = (await vi.importActual(
        '@/utils/litegraphUtil'
      )) as {
        resolveNode: (nodeId: NodeId, graph: LGraph) => LGraphNode | undefined
      }
      const originalRootGraph = app.rootGraph

      mockResolveNode.mockImplementation((id) => actualResolveNode(id, graph))
      Object.defineProperty(app, 'rootGraph', { value: graph, writable: true })

      try {
        store.loadSelections({
          inputs: [[promoted.sourceNodeId, promoted.sourceWidgetName]],
          outputs: []
        })

        expect(store.selectedInputs).toEqual([[host.id, promoted.storeName]])
      } finally {
        Object.defineProperty(app, 'rootGraph', {
          value: originalRootGraph,
          writable: true
        })
      }
    })

    it('preserves selected promoted-widget identity per instance across save/reload', async () => {
      // Build one subgraph definition with one promoted widget,
      // then create two SubgraphNode instances of that definition.
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: '*' }]
      })
      const inner = new LiteGraphNode('Inner')
      const input = inner.addInput('value', '*')
      inner.addWidget('text', 'value', 'a', () => {})
      input.widget = { name: 'value' }
      subgraph.add(inner)
      subgraph.inputNode.slots[0].connect(input, inner)

      const hostA = createTestSubgraphNode(subgraph, { id: 701 })
      hostA._internalConfigureAfterSlots()
      hostA.graph!.add(hostA)

      const hostB = createTestSubgraphNode(subgraph, { id: 702 })
      hostB._internalConfigureAfterSlots()
      hostB.graph!.add(hostB)

      const promotionStore = usePromotionStore()
      promotionStore.setPromotions(hostA.rootGraph.id, hostA.id, [
        { sourceNodeId: String(inner.id), sourceWidgetName: 'value' }
      ])
      promotionStore.setPromotions(hostB.rootGraph.id, hostB.id, [
        { sourceNodeId: String(inner.id), sourceWidgetName: 'value' }
      ])

      const promotedA = hostA.widgets.find(isPromotedWidgetView)
      const promotedB = hostB.widgets.find(isPromotedWidgetView)
      if (!promotedA || !promotedB) throw new Error('Expected promoted views')

      // Precondition: storeNames are equal (interior identity matches),
      // host ids differ.
      expect(promotedA.storeName).toBe(promotedB.storeName)
      expect(hostA.id).not.toBe(hostB.id)

      const { resolveNode: actualResolveNode } = (await vi.importActual(
        '@/utils/litegraphUtil'
      )) as {
        resolveNode: (nodeId: NodeId, graph: LGraph) => LGraphNode | undefined
      }
      const graph = hostA.graph!
      const originalRootGraph = app.rootGraph
      mockResolveNode.mockImplementation((id) => actualResolveNode(id, graph))
      Object.defineProperty(app, 'rootGraph', { value: graph, writable: true })

      try {
        store.loadSelections({
          inputs: [
            [hostA.id, promotedA.storeName],
            [hostB.id, promotedB.storeName]
          ],
          outputs: []
        })

        expect(store.selectedInputs).toHaveLength(2)
        expect(store.selectedInputs).toEqual(
          expect.arrayContaining([
            [hostA.id, promotedA.storeName],
            [hostB.id, promotedB.storeName]
          ])
        )
      } finally {
        Object.defineProperty(app, 'rootGraph', {
          value: originalRootGraph,
          writable: true
        })
      }
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
        outputs: [1]
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
        outputs: []
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
        outputs: []
      })
    })
  })

  describe('removeSelectedInput', () => {
    it('uses host node id and promoted storeName', () => {
      const { host, promoted } = createPromotedWidgetFixture(601)

      store.selectedInputs = [[host.id, promoted.storeName]]

      store.removeSelectedInput(promoted, host)

      expect(store.selectedInputs).toEqual([])
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
})
