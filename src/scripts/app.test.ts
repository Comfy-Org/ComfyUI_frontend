import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { ComfyApp } from './app'
import { createNode } from '@/utils/litegraphUtil'
import {
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes
} from '@/composables/usePaste'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { api } from '@/scripts/api'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import type { NodeError } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const {
  mockApiKeyAuthStore,
  mockAuthStore,
  mockSettingStore,
  mockToastStore,
  mockExtensionService,
  mockNodeOutputStore,
  mockWorkspaceWorkflow,
  mockRefreshMissingModelPipeline
} = vi.hoisted(() => ({
  mockApiKeyAuthStore: {
    getApiKey: vi.fn()
  },
  mockAuthStore: {
    getAuthToken: vi.fn()
  },
  mockSettingStore: {
    get: vi.fn()
  },
  mockToastStore: {
    addAlert: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  },
  mockExtensionService: {
    invokeExtensions: vi.fn(),
    invokeExtensionsAsync: vi.fn()
  },
  mockNodeOutputStore: {
    refreshNodeOutputs: vi.fn()
  },
  mockWorkspaceWorkflow: {
    activeWorkflow: null as ComfyWorkflow | null
  },
  mockRefreshMissingModelPipeline: vi.fn()
}))

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn(),
  isAudioNode: vi.fn(),
  executeWidgetsCallback: vi.fn(),
  fixLinkInputSlots: vi.fn()
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: vi.fn(() => mockApiKeyAuthStore)
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

vi.mock('@/composables/usePaste', () => ({
  pasteAudioNode: vi.fn(),
  pasteAudioNodes: vi.fn(),
  pasteImageNode: vi.fn(),
  pasteImageNodes: vi.fn(),
  pasteVideoNode: vi.fn(),
  pasteVideoNodes: vi.fn()
}))

vi.mock('@/scripts/metadata/parser', () => ({
  getWorkflowDataFromFile: vi.fn()
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    uploadFile: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => mockExtensionService)
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: vi.fn(() => mockNodeOutputStore)
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workflow: mockWorkspaceWorkflow
  }))
}))

vi.mock('@/platform/missingModel/missingModelPipeline', () => ({
  refreshMissingModelPipeline: mockRefreshMissingModelPipeline,
  runMissingModelPipeline: vi.fn()
}))

function createMockNode(options: { [K in keyof LGraphNode]?: any } = {}) {
  return {
    id: 1,
    pos: [0, 0],
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  } as LGraphNode
}

function createMockCanvas(): Partial<LGraphCanvas> {
  const mockGraph: Partial<LGraph> = {
    change: vi.fn()
  }

  return {
    graph: mockGraph as LGraph,
    draw: vi.fn(),
    selectItems: vi.fn()
  }
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

function createWorkflowGraphData(): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

describe('ComfyApp', () => {
  let app: ComfyApp
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app = new ComfyApp()
    mockCanvas = createMockCanvas() as LGraphCanvas
    app.canvas = mockCanvas as LGraphCanvas
    mockWorkspaceWorkflow.activeWorkflow = null
    mockApiKeyAuthStore.getApiKey.mockReturnValue(undefined)
    mockAuthStore.getAuthToken.mockResolvedValue(undefined)
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue(undefined)
    mockSettingStore.get.mockImplementation((key: string) =>
      key === 'Comfy.RightSidePanel.ShowErrorsTab' ? true : undefined
    )
  })

  describe('queuePrompt', () => {
    it('shows the error overlay for successful prompt responses with node errors', async () => {
      const graph = new LGraph()
      const workflow = new ComfyWorkflow({
        path: 'workflows/review.json',
        modified: 0,
        size: 0
      })
      const promptOutput: ComfyApiWorkflow = {
        '1': {
          class_type: 'PreviewAny',
          inputs: {},
          _meta: { title: 'PreviewAny' }
        }
      }
      const nodeErrors: Record<string, NodeError> = {
        '1': {
          class_type: 'PreviewAny',
          dependent_outputs: ['1'],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing: source',
              details: '',
              extra_info: { input_name: 'source' }
            }
          ]
        }
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      mockWorkspaceWorkflow.activeWorkflow = workflow
      vi.spyOn(app, 'graphToPrompt').mockResolvedValue({
        output: promptOutput,
        workflow: createWorkflowGraphData()
      })
      vi.spyOn(api, 'dispatchCustomEvent').mockImplementation(() => true)
      vi.spyOn(api, 'queuePrompt').mockResolvedValue({
        prompt_id: 'job-1',
        node_errors: nodeErrors,
        error: ''
      })

      await expect(app.queuePrompt(0)).resolves.toBe(false)

      const errorStore = useExecutionErrorStore()
      const executionStore = useExecutionStore()
      expect(errorStore.lastNodeErrors).toEqual(nodeErrors)
      expect(errorStore.isErrorOverlayOpen).toBe(true)
      expect(executionStore.queuedJobs['job-1']?.nodes).toEqual({ '1': false })
      expect(executionStore.jobIdToSessionWorkflowPath.get('job-1')).toBe(
        'workflows/review.json'
      )
      expect(mockCanvas.draw).toHaveBeenCalledWith(true, true)
    })
  })

  describe('refreshComboInNodes', () => {
    it('shows success toast and removes the pending toast after node defs reload', async () => {
      app.vueAppReady = true
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()

      await app.refreshComboInNodes()

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })

    it('shows failure toast, removes the pending toast, and rethrows reload failures', async () => {
      app.vueAppReady = true
      const error = new Error('object_info failed')
      vi.spyOn(app, 'reloadNodeDefs').mockRejectedValue(error)

      await expect(app.refreshComboInNodes()).rejects.toThrow(error)

      expect(mockToastStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockToastStore.remove).toHaveBeenCalledWith(
        mockToastStore.add.mock.calls[0][0]
      )
    })
  })

  describe('reloadNodeDefs', () => {
    it('syncs refreshed combo options into promoted combo host state', async () => {
      const initialOptions = ['missing.safetensors']
      const refreshedOptions = ['missing.safetensors', 'present.safetensors']

      const rootGraph = createTestRootGraph()
      const subgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'ckpt_name', type: '*' }]
      })

      const interiorNode = new LGraphNode(
        'CheckpointLoaderSimple',
        'CheckpointLoaderSimple'
      )
      const interiorInput = interiorNode.addInput('ckpt_name', '*')
      interiorInput.widget = { name: 'ckpt_name' }
      const interiorWidget = interiorNode.addWidget(
        'combo',
        'ckpt_name',
        'missing.safetensors',
        () => {},
        { values: initialOptions }
      )
      subgraph.add(interiorNode)
      subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

      const host = createTestSubgraphNode(subgraph)
      rootGraph.add(host)

      const hostWidgetId = host.inputs[0].widgetId
      if (!hostWidgetId) throw new Error('Expected a promoted host widgetId')

      const widgetValueStore = useWidgetValueStore()
      expect(widgetValueStore.getWidget(hostWidgetId)?.options).toEqual({
        values: initialOptions
      })

      const defs: Record<string, ComfyNodeDef> = {
        CheckpointLoaderSimple: {
          name: 'CheckpointLoaderSimple',
          display_name: 'CheckpointLoaderSimple',
          category: 'loaders',
          python_module: 'nodes',
          description: '',
          input: {
            required: {
              ckpt_name: [refreshedOptions, {}]
            },
            optional: {}
          },
          output: [],
          output_name: [],
          output_tooltips: [],
          output_node: false,
          deprecated: false,
          experimental: false
        }
      }
      Reflect.set(app, 'rootGraphInternal', rootGraph)
      vi.spyOn(app, 'getNodeDefs').mockResolvedValue(defs)
      vi.spyOn(app, 'registerNodeDef').mockResolvedValue(undefined)

      await app.reloadNodeDefs()

      expect(interiorWidget.options.values).toEqual(refreshedOptions)
      expect(widgetValueStore.getWidget(hostWidgetId)?.options.values).toEqual(
        refreshedOptions
      )
      expect(mockExtensionService.invokeExtensionsAsync).toHaveBeenCalledWith(
        'refreshComboInNodes',
        defs
      )
    })
  })

  describe('refreshMissingModels', () => {
    it('delegates to the app-independent missing model refresh pipeline', async () => {
      const graph = {
        nodes: [],
        serialize: vi.fn(() => createWorkflowGraphData())
      }
      const result = {
        missingModels: [],
        confirmedCandidates: []
      }
      Reflect.set(app, 'rootGraphInternal', graph)
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()
      mockRefreshMissingModelPipeline.mockResolvedValue(result)

      await expect(app.refreshMissingModels({ silent: false })).resolves.toBe(
        result
      )

      expect(mockRefreshMissingModelPipeline).toHaveBeenCalledWith({
        graph,
        reloadNodeDefs: expect.any(Function),
        missingModelStore: useMissingModelStore(),
        silent: false
      })

      await mockRefreshMissingModelPipeline.mock.calls[0][0].reloadNodeDefs()
      expect(app.reloadNodeDefs).toHaveBeenCalled()
    })
  })

  describe('handleFileList', () => {
    it('should create image nodes for each file in the list', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      const mockNode2 = createMockNode({ id: 2 })
      const mockBatchNode = createMockNode({ id: 3, type: 'BatchImagesNode' })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(mockBatchNode)

      const file1 = createTestFile('test1.png', 'image/png')
      const file2 = createTestFile('test2.jpg', 'image/jpeg')
      const files = [file1, file2]

      await app.handleFileList(files)

      expect(pasteImageNodes).toHaveBeenCalledWith(mockCanvas, files)
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'BatchImagesNode')
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2,
        mockBatchNode
      ])
      expect(mockNode1.connect).toHaveBeenCalledWith(0, mockBatchNode, 0)
      expect(mockNode2.connect).toHaveBeenCalledWith(0, mockBatchNode, 1)
    })

    it('should select single image node without batch node', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1])

      const file = createTestFile('test.png', 'image/png')

      await app.handleFileList([file])

      expect(createNode).not.toHaveBeenCalled()
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([mockNode1])
      expect(mockNode1.connect).not.toHaveBeenCalled()
    })

    it('should handle empty file list', async () => {
      await app.handleFileList([])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not process unsupported file types', async () => {
      const invalidFile = createTestFile('test.pdf', 'application/pdf')

      await app.handleFileList([invalidFile])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })
  })

  describe('handleAudioFileList', () => {
    it('should create audio nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadAudio' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadAudio' })
      vi.mocked(pasteAudioNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp3', 'audio/mpeg')
      const file2 = createTestFile('test2.wav', 'audio/wav')

      await app.handleAudioFileList([file1, file2])

      expect(pasteAudioNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteAudioNodes).mockResolvedValue([])

      await app.handleAudioFileList([createTestFile('test.mp3', 'audio/mpeg')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('handleVideoFileList', () => {
    it('should create video nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadVideo' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadVideo' })
      vi.mocked(pasteVideoNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp4', 'video/mp4')
      const file2 = createTestFile('test2.webm', 'video/webm')

      await app.handleVideoFileList([file1, file2])

      expect(pasteVideoNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteVideoNodes).mockResolvedValue([])

      await app.handleVideoFileList([createTestFile('test.mp4', 'video/mp4')])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('positionBatchNodes', () => {
    it('should position batch node to the right of first node', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockBatchNode.pos).toEqual([500, 230])
    })

    it('should stack multiple image nodes vertically', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        type: 'LoadImage',
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockNode2 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockNode3 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1, mockNode2, mockNode3], mockBatchNode)

      expect(mockNode1.pos).toEqual([100, 200])
      expect(mockNode2.pos).toEqual([100, 594])
      expect(mockNode3.pos).toEqual([100, 963])
    })

    it('should call graph change once for all nodes', () => {
      const mockNode1 = createMockNode({
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode()

      app.positionBatchNodes([mockNode1], mockBatchNode)

      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleFile', () => {
    it('should handle image files by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('test.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle audio files by creating LoadAudio node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadAudio' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const audioFile = createTestFile('test.mp3', 'audio/mpeg')

      await app.handleFile(audioFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadAudio')
      expect(pasteAudioNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle video files by creating LoadVideo node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode({ type: 'LoadVideo' })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const videoFile = createTestFile('test.mp4', 'video/mp4')

      await app.handleFile(videoFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadVideo')
      expect(pasteVideoNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should handle mesh model files by uploading and creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/model.glb')

      const modelWidget = {
        name: 'model_file',
        value: 'existing.glb',
        options: { values: ['existing.glb'] }
      }
      const mockNode = createMockNode({
        type: 'Load3DAdvanced',
        widgets: [modelWidget]
      })
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const meshFile = createTestFile('model.glb', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'Load3DAdvanced')
      expect(modelWidget.value).toBe('3d/model.glb')
      expect(modelWidget.options.values).toContain('3d/model.glb')
    })

    it('should load embedded workflow from mesh files instead of creating Load3DAdvanced node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        workflow: createWorkflowGraphData()
      })
      const loadGraphData = vi
        .spyOn(app, 'loadGraphData')
        .mockResolvedValue(undefined)

      const meshFile = createTestFile('model.glb', 'model/gltf-binary')

      await app.handleFile(meshFile)

      expect(loadGraphData).toHaveBeenCalled()
      expect(Load3dUtils.uploadFile).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not create Load3DAdvanced node when mesh upload fails', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue(undefined)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue(undefined)

      const meshFile = createTestFile('model.obj', '')

      await app.handleFile(meshFile)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(meshFile, '3d')
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should handle image files with non-workflow metadata by creating LoadImage node', async () => {
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({
        Software: 'gnome-screenshot'
      })

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createTestFile('screenshot.png', 'image/png')

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })
  })

  describe('drop handler', () => {
    it('syncs graph_mouse from the drop event before downstream handlers run', async () => {
      // graph_mouse is only updated on mousemove, so when files are dragged in
      // from another window the canvas-space cursor is stale. The drop handler
      // must derive the position from the drop event itself.
      const graphMouse: [number, number] = [-999, -999]
      const adjustMouseEvent = vi.fn((e: DragEvent) => {
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasX = 123
        ;(e as DragEvent & { canvasX: number; canvasY: number }).canvasY = 456
      })
      app.canvas = {
        ...mockCanvas,
        graph_mouse: graphMouse,
        adjustMouseEvent
      } as unknown as LGraphCanvas

      ;(app as unknown as { addDropHandler(): void }).addDropHandler()

      document.dispatchEvent(new DragEvent('drop'))
      await Promise.resolve()

      expect(adjustMouseEvent).toHaveBeenCalledTimes(1)
      expect(graphMouse).toEqual([123, 456])
    })
  })
})
