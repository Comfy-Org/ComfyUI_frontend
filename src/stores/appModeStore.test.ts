import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'
import type { SerializedNodeId } from '@/types/nodeId'
import {
  LGraphNode as LGraphNodeClass,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { widgetId } from '@/types/widgetId'
import type {
  InputWidgetConfig,
  LinearInput,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import type { WidgetId } from '@/types/widgetId'

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
  vi.fn<(id: SerializedNodeId) => LGraphNode | undefined>(() => undefined)
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

function createBuilderWorkflowWithOutputs(
  activeMode: string
): LoadedComfyWorkflow {
  mockResolveNode.mockReturnValue(fromAny({ id: 1 }))
  const workflow = createBuilderWorkflow(activeMode)
  workflow.changeTracker!.activeState!.extra ??= {}
  workflow.changeTracker.activeState.extra.linearData = {
    inputs: [],
    outputs: [toNodeId(1)]
  }
  return workflow
}

function createWorkflowWithLinearData(
  activeMode: string,
  inputs: LinearInput[],
  outputs: SerializedNodeId[]
): LoadedComfyWorkflow {
  const workflow = createBuilderWorkflow(activeMode)
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
        extra: { linearData: fromAny({ inputs, outputs }) }
      }
    })
  )
  return workflow
}

const rootGraphId = '11111111-1111-4111-8111-111111111111'
const entityPrompt = `${rootGraphId}:1:prompt` as WidgetId
const entitySeed = `${rootGraphId}:1:seed` as WidgetId
const entitySteps = `${rootGraphId}:1:steps` as WidgetId

function nodeWithWidgets(id: number, widgetNames: string[]) {
  return fromAny<LGraphNode, unknown>({
    id,
    widgets: widgetNames.map((name) => ({
      name,
      widgetId: `${rootGraphId}:${id}:${name}` as WidgetId
    }))
  })
}

describe('appModeStore', () => {
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let store: ReturnType<typeof useAppModeStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.mocked(app.rootGraph).extra = {}
    ChangeTracker.isLoadingGraph = false
    mockResolveNode.mockReturnValue(undefined)
    mockSettings.reset()
    vi.mocked(app.rootGraph).nodes = [{ id: toNodeId(1) } as LGraphNode]
    workflowStore = useWorkflowStore()
    store = useAppModeStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
      store.selectedOutputs.push(toNodeId(1))

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

    it('prunes selections from workflow state on entry', () => {
      const node1 = nodeWithWidgets(1, ['seed'])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )
      workflowStore.activeWorkflow = createWorkflowWithLinearData(
        'graph',
        [
          [1, 'seed'],
          [99, 'steps']
        ],
        [toNodeId(1), toNodeId(99)]
      )
      store.selectedInputs = [[42, 'prompt']]
      store.selectedOutputs = [toNodeId(42)]

      store.enterBuilder()

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
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
      const options = getDialogOptions([{ id: toNodeId(1) } as LGraphNode])

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

  describe('exitBuilder', () => {
    it('prunes selections from workflow state on exit', () => {
      const node1 = nodeWithWidgets(1, ['seed'])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )
      workflowStore.activeWorkflow = createWorkflowWithLinearData(
        'builder:inputs',
        [
          [1, 'seed'],
          [99, 'steps']
        ],
        [toNodeId(1), toNodeId(99)]
      )
      store.selectedInputs = [[42, 'prompt']]
      store.selectedOutputs = [toNodeId(42)]

      store.exitBuilder()

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })
  })

  describe('loadSelections pruning', () => {
    beforeEach(() => {
      vi.mocked(app.rootGraph).id = rootGraphId
    })

    it('migrates legacy node-id inputs to entity-id form and drops missing ones', () => {
      const node1 = nodeWithWidgets(1, ['prompt'])
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )

      store.loadSelections({
        inputs: [
          [1, 'prompt'],
          [99, 'width']
        ]
      })

      expect(store.selectedInputs).toEqual([[entityPrompt, 'prompt']])
    })

    it('preserves config through pruning', () => {
      const node1 = nodeWithWidgets(1, ['prompt'])
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )

      store.loadSelections({
        inputs: [[1, 'prompt', { height: 150 }]]
      })

      expect(store.selectedInputs).toEqual([
        [entityPrompt, 'prompt', { height: 150 }]
      ])
    })

    it('passes through entries already in canonical entity-id form', () => {
      const node1 = nodeWithWidgets(1, ['prompt'])
      vi.mocked(app.rootGraph).nodes = [node1]

      store.loadSelections({
        inputs: [[entityPrompt, 'prompt']]
      })

      expect(store.selectedInputs).toEqual([[entityPrompt, 'prompt']])
    })

    it('drops legacy entries whose widget no longer exists', () => {
      const node1 = nodeWithWidgets(1, ['prompt'])
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      store.loadSelections({
        inputs: [
          [1, 'prompt'],
          [1, 'deleted_widget']
        ]
      })

      expect(store.selectedInputs).toEqual([[entityPrompt, 'prompt']])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dropping legacy selectedInput tuple'),
        expect.objectContaining({ widgetName: 'deleted_widget' })
      )
      warnSpy.mockRestore()
    })

    it('removes outputs referencing deleted nodes on load', () => {
      const node1 = { id: 1 }
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? fromAny<LGraphNode, unknown>(node1) : undefined
      )

      store.loadSelections({ outputs: [toNodeId(1), toNodeId(99)] })

      expect(store.selectedOutputs).toEqual([toNodeId(1)])
    })

    it('reloads selections on configured event', async () => {
      const node1 = nodeWithWidgets(1, ['seed'])

      // Initially nodes are not resolvable — pruning removes them
      vi.mocked(app.rootGraph).nodes = []
      vi.mocked(app.rootGraph).getNodeById = vi.fn(() => null)
      mockResolveNode.mockReturnValue(undefined)
      const inputs: [number, string][] = [[1, 'seed']]
      workflowStore.activeWorkflow = createWorkflowWithLinearData(
        'app',
        inputs,
        [1]
      )
      store.loadSelections({ inputs })
      await nextTick()

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])

      // After graph configures, nodes become resolvable
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )
      ;(app.rootGraph.events as EventTarget).dispatchEvent(
        new Event('configured')
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
    })

    it('hasOutputs is false when all output nodes are deleted', () => {
      mockResolveNode.mockReturnValue(undefined)

      store.loadSelections({ outputs: [10, 20] })

      expect(store.selectedOutputs).toEqual([])
      expect(store.hasOutputs).toBe(false)
    })
  })

  describe('loadSelections edge cases', () => {
    it('clears existing selections on undefined or empty data', () => {
      store.selectedInputs = [[1, 'seed']]
      store.selectedOutputs = [toNodeId(1)]

      store.loadSelections(undefined)

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])

      store.selectedInputs = [[1, 'seed']]
      store.selectedOutputs = [toNodeId(1)]

      store.loadSelections({})

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])
    })
  })

  describe('pruneLinearData', () => {
    it('returns empty selections for undefined data', () => {
      expect(store.pruneLinearData(undefined)).toEqual({
        inputs: [],
        outputs: []
      })
    })

    it('does not prune when rootGraph is empty', () => {
      const originalRootGraph = app.rootGraph
      Object.defineProperty(app, 'rootGraph', { value: null, writable: true })

      try {
        expect(
          store.pruneLinearData({
            inputs: [[1, 'seed']],
            outputs: [toNodeId(1)]
          })
        ).toEqual({
          inputs: [[1, 'seed']],
          outputs: [toNodeId(1)]
        })
      } finally {
        Object.defineProperty(app, 'rootGraph', {
          value: originalRootGraph,
          writable: true
        })
      }
    })

    it('resolves mixed int/string node ids to the same node', () => {
      const node3 = nodeWithWidgets(3, ['file'])
      const node5 = nodeWithWidgets(5, [
        'upscaler_model',
        'upscaler_resolution',
        'upscaler_creativity'
      ])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node3, node5]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(3) ? node3 : id === toNodeId(5) ? node5 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(5) ? node5 : undefined
      )

      const result = store.pruneLinearData({
        inputs: [
          [3, 'file'],
          [5, 'upscaler_model'],
          [5, 'upscaler_resolution'],
          ['5', 'upscaler_creativity']
        ],
        outputs: [5, '5']
      })

      expect(result.inputs).toEqual([
        [`${rootGraphId}:3:file`, 'file'],
        [`${rootGraphId}:5:upscaler_model`, 'upscaler_model'],
        [`${rootGraphId}:5:upscaler_resolution`, 'upscaler_resolution'],
        [`${rootGraphId}:5:upscaler_creativity`, 'upscaler_creativity']
      ])
      expect(result.outputs).toEqual([toNodeId(5), toNodeId(5)])
    })
  })

  describe('loadSelections app-config warning', () => {
    it('warns when non-empty linearData resolves to nothing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [nodeWithWidgets(1, ['seed'])]
      vi.mocked(app.rootGraph).getNodeById = vi.fn(() => null)
      mockResolveNode.mockReturnValue(undefined)

      store.loadSelections({ inputs: [[99, 'gone']], outputs: [99] })

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('app config could not be interpreted'),
        expect.anything()
      )
      warnSpy.mockRestore()
    })

    it('does not warn when the config resolves', () => {
      const node1 = nodeWithWidgets(1, ['seed'])
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )

      store.loadSelections({ inputs: [[1, 'seed']], outputs: [toNodeId(1)] })

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('app config could not be interpreted'),
        expect.anything()
      )
      warnSpy.mockRestore()
    })

    it('does not warn for empty config', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(app.rootGraph).nodes = [nodeWithWidgets(1, ['seed'])]

      store.loadSelections({})

      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('pruneLinearData during graph loading', () => {
    it('still upgrades legacy inputs but defers output pruning when ChangeTracker.isLoadingGraph is true', () => {
      const node1 = nodeWithWidgets(1, ['seed'])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      ChangeTracker.isLoadingGraph = true

      store.loadSelections({
        inputs: [
          [1, 'seed'],
          [999, 'steps']
        ],
        outputs: [1, 999]
      })

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1), toNodeId(999)])
    })

    it('prunes entries for deleted nodes when not loading', () => {
      const node1 = nodeWithWidgets(1, ['seed'])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )

      store.loadSelections({
        inputs: [
          [1, 'seed'],
          [999, 'steps']
        ],
        outputs: [1, 999]
      })

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
    })
  })

  describe('resetSelectedToWorkflow fallback', () => {
    function setupNodeWithSeedAndSteps() {
      const node1 = nodeWithWidgets(1, ['seed', 'steps'])
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [node1]
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        id === toNodeId(1) ? node1 : null
      )
      mockResolveNode.mockImplementation((id) =>
        id === toNodeId(1) ? node1 : undefined
      )
    }

    it('falls back to initialState when activeState has no linearData', () => {
      setupNodeWithSeedAndSteps()
      const workflow = createBuilderWorkflow('app')
      workflow.changeTracker.activeState.extra = {}
      workflow.changeTracker.initialState = fromAny({
        ...workflow.changeTracker.activeState,
        extra: {
          linearData: { inputs: [[1, 'seed']], outputs: [toNodeId(1)] }
        }
      })
      workflowStore.activeWorkflow = workflow

      store.resetSelectedToWorkflow()

      expect(store.selectedInputs).toEqual([[entitySeed, 'seed']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
    })

    it('prefers activeState linearData when available', () => {
      setupNodeWithSeedAndSteps()
      const workflow = createBuilderWorkflow('app')
      workflow.changeTracker.activeState.extra = {
        linearData: { inputs: [[1, 'steps']], outputs: [toNodeId(1)] }
      }
      workflow.changeTracker.initialState = fromAny({
        ...workflow.changeTracker.activeState,
        extra: {
          linearData: { inputs: [[1, 'seed']], outputs: [toNodeId(1)] }
        }
      })
      workflowStore.activeWorkflow = workflow

      store.resetSelectedToWorkflow()

      expect(store.selectedInputs).toEqual([[entitySteps, 'steps']])
      expect(store.selectedOutputs).toEqual([toNodeId(1)])
    })
  })

  describe('linearData sync watcher', () => {
    it('writes linearData to rootGraph.extra when in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedOutputs.push(toNodeId(1))
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [toNodeId(1)]
      })
    })

    it('does not write linearData when not in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      await nextTick()

      store.selectedOutputs.push(toNodeId(1))
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('does not write when rootGraph is null', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      const originalRootGraph = app.rootGraph
      const dataBefore = JSON.parse(
        JSON.stringify(originalRootGraph.extra.linearData)
      )
      Object.defineProperty(app, 'rootGraph', { value: null, writable: true })

      try {
        store.selectedOutputs.push(toNodeId(1))
        await nextTick()
      } finally {
        Object.defineProperty(app, 'rootGraph', {
          value: originalRootGraph,
          writable: true
        })
      }

      expect(originalRootGraph.extra.linearData).toEqual(dataBefore)
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
    const entity = 'g:1:prompt' as WidgetId
    const otherEntity = 'g:99:prompt' as WidgetId
    const widget = fromAny<IBaseWidget, unknown>({ widgetId: entity })
    const otherWidget = fromAny<IBaseWidget, unknown>({ widgetId: otherEntity })

    it('sets config on an existing input', () => {
      store.selectedInputs.push([entity, 'prompt'])

      store.updateInputConfig(widget, { height: 200 })

      expect(store.selectedInputs[0][2]).toEqual({ height: 200 })
    })

    it('is a no-op when entry is not found', () => {
      store.selectedInputs.push([entity, 'prompt'])

      store.updateInputConfig(otherWidget, { height: 200 })

      expect(store.selectedInputs[0][2]).toBeUndefined()
    })

    it('is a no-op when the widget has no widgetId', () => {
      store.selectedInputs.push([entity, 'prompt'])

      store.updateInputConfig(
        fromAny<IBaseWidget, unknown>({ widgetId: undefined }),
        { height: 200 }
      )

      expect(store.selectedInputs[0][2]).toBeUndefined()
    })

    it('merges existing config with new values', () => {
      const existingConfig: InputWidgetConfig & { width: number } = {
        height: 120,
        width: 240
      }
      store.selectedInputs.push([entity, 'prompt', existingConfig])

      store.updateInputConfig(widget, { height: 300 })

      expect(store.selectedInputs[0][2]).toEqual({ height: 300, width: 240 })
    })

    it('triggers linearData sync watcher', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([entity, 'prompt'])
      await nextTick()

      store.updateInputConfig(widget, { height: 300 })
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[entity, 'prompt', { height: 300 }]],
        outputs: []
      })
    })
  })

  describe('removeSelectedInput', () => {
    it('removes the matching input entry only', () => {
      const promptEntity = 'g:1:prompt' as WidgetId
      const stepsEntity = 'g:2:steps' as WidgetId
      const stepsWidget = fromAny<IBaseWidget, unknown>({
        widgetId: stepsEntity,
        name: 'steps'
      })
      store.selectedInputs.push([promptEntity, 'prompt'])
      store.selectedInputs.push([stepsEntity, 'steps'])

      store.removeSelectedInput(stepsWidget)

      expect(store.selectedInputs).toEqual([[promptEntity, 'prompt']])
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

  describe('displayViewMode', () => {
    const rafQueue = new Map<number, FrameRequestCallback>()
    let nextHandle: number

    const advanceFrame = () => {
      const callbacks = [...rafQueue.values()]
      rafQueue.clear()
      for (const cb of callbacks) cb(0)
    }

    beforeEach(() => {
      rafQueue.clear()
      nextHandle = 0
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        const handle = ++nextHandle
        rafQueue.set(handle, cb)
        return handle
      })
      vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
        rafQueue.delete(handle)
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('lags the view mode by two frames so the toggle can animate the switch', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      await nextTick()
      expect(store.displayViewMode).toBe('graph')

      workflowStore.activeWorkflow.activeMode = 'app'
      await nextTick()

      // The real mode has flipped, but the displayed mode still lags so a toggle
      // that mounts now renders the old order before animating to the new one.
      expect(store.viewMode).toBe('app')
      expect(store.displayViewMode).toBe('graph')

      // First frame only schedules the second; the displayed mode must not move.
      advanceFrame()
      expect(store.displayViewMode).toBe('graph')

      // The second frame is the one that flips the displayed mode.
      advanceFrame()
      expect(store.displayViewMode).toBe('app')
    })

    it('cancels a stale frame chain so a rapid toggle has no transient flash', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      workflowStore.activeWorkflow.activeMode = 'app'
      await nextTick()
      advanceFrame()

      workflowStore.activeWorkflow.activeMode = 'graph'
      await nextTick()

      // The pending second frame from the first toggle is cancelled, so it can
      // no longer flip the displayed mode to 'app' before settling on 'graph'.
      advanceFrame()
      expect(store.displayViewMode).toBe('graph')

      advanceFrame()
      expect(store.displayViewMode).toBe('graph')
    })
  })

  describe('legacy selectedInput tuple migration', () => {
    const rootGraphId = '11111111-1111-4111-8111-111111111111'

    it('migrates legacy `(sourceNodeId, sourceWidgetName)` to the host promoted widget entity id', () => {
      const subgraphInputName = 'Prompt'
      const sourceWidgetName = 'text'

      const subgraph = createTestSubgraph({
        inputs: [{ name: subgraphInputName, type: 'STRING' }]
      })
      const interior = new LGraphNodeClass('Interior')
      const interiorInput = interior.addInput(subgraphInputName, 'STRING')
      interior.addWidget('string', sourceWidgetName, '', () => undefined)
      interiorInput.widget = { name: sourceWidgetName }
      subgraph.add(interior)
      subgraph.inputNode.slots[0].connect(interiorInput, interior)

      const host = createTestSubgraphNode(subgraph, { id: 5 })
      const rootGraph = host.graph as LGraph
      rootGraph.add(host)
      host._internalConfigureAfterSlots()

      const promotedEntityId = widgetId(
        rootGraph.id,
        host.id,
        subgraphInputName
      )

      vi.mocked(app.rootGraph).id = rootGraph.id
      vi.mocked(app.rootGraph).nodes = rootGraph.nodes
      vi.mocked(app.rootGraph).getNodeById = vi.fn((id) =>
        rootGraph.getNodeById(id)
      )

      expect(rootGraph.getNodeById(interior.id)).toBeUndefined()

      const result = store.pruneLinearData({
        inputs: [[interior.id, sourceWidgetName, { height: 120 }]],
        outputs: []
      })

      expect(result.inputs).toEqual([
        [promotedEntityId, subgraphInputName, { height: 120 }]
      ])
    })

    it('keeps a direct root-node widget when its id and name collide with a promoted source', () => {
      const hostId = 5
      const sourceNodeId = 42
      const sourceWidgetName = 'text'
      const rootEntityId =
        `${rootGraphId}:${sourceNodeId}:${sourceWidgetName}` as WidgetId
      const rootNode = fromAny<LGraphNode, unknown>({
        id: sourceNodeId,
        widgets: [{ name: sourceWidgetName, widgetId: rootEntityId }]
      })
      const hostWidget = {
        name: 'Prompt',
        sourceNodeId: String(sourceNodeId),
        sourceWidgetName,
        widgetId: `${rootGraphId}:${hostId}:Prompt` as WidgetId
      }
      const hostNode = Object.assign(Object.create(SubgraphNode.prototype), {
        id: hostId,
        inputs: [{ name: 'Prompt', _widget: hostWidget }],
        widgets: [hostWidget],
        isSubgraphNode: () => true
      }) as SubgraphNode

      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [rootNode, hostNode]
      vi.mocked(app.rootGraph).getNodeById = vi.fn(
        (id: SerializedNodeId | null | undefined) =>
          id == sourceNodeId ? rootNode : id == hostId ? hostNode : null
      )

      const result = store.pruneLinearData({
        inputs: [[sourceNodeId, sourceWidgetName, { height: 120 }]],
        outputs: []
      })

      expect(result.inputs).toEqual([
        [rootEntityId, sourceWidgetName, { height: 120 }]
      ])
    })

    it('warns and drops a tuple whose target widget no longer resolves', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = []
      vi.mocked(app.rootGraph).getNodeById = vi.fn(() => null)

      const result = store.pruneLinearData({
        inputs: [[42, 'widget-name', { height: 42 }]],
        outputs: []
      })

      expect(result.inputs).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('legacy selectedInput tuple'),
        expect.objectContaining({
          storedId: 42,
          widgetName: 'widget-name'
        })
      )
      warnSpy.mockRestore()
    })

    it('migrates legacy `hostLocator:subgraphInputName` tuples to entity-id form', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const hostId = 5
      const hostLocator = `${rootGraphId}:${hostId}`
      const promotedEntityId =
        `${rootGraphId}:${hostId}:subgraph_input_name` as WidgetId
      const hostNode = fromAny<LGraphNode, unknown>({
        id: hostId,
        isSubgraphNode: () => true,
        widgets: [{ name: 'subgraph_input_name', widgetId: promotedEntityId }]
      })
      vi.mocked(app.rootGraph).id = rootGraphId
      vi.mocked(app.rootGraph).nodes = [hostNode]
      vi.mocked(app.rootGraph).getNodeById = vi.fn(
        (id: SerializedNodeId | null | undefined) =>
          id == hostId ? hostNode : null
      )

      const result = store.pruneLinearData({
        inputs: [[hostLocator, 'subgraph_input_name']],
        outputs: []
      })

      expect(result.inputs).toEqual([[promotedEntityId, 'subgraph_input_name']])
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })
})
