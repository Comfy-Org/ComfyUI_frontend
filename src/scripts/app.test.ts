import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  ComfyWorkflowJSON,
  ModelFile
} from '@/platform/workflow/validation/schemas/workflowSchema'
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
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { MissingModelCandidate } from '@/platform/missingModel/types'

const {
  mockToastStore,
  mockExtensionService,
  mockNodeOutputStore,
  mockWorkspaceWorkflow
} = vi.hoisted(() => ({
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
    activeWorkflow: null as unknown
  }
}))

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn(),
  isAudioNode: vi.fn(),
  executeWidgetsCallback: vi.fn(),
  fixLinkInputSlots: vi.fn()
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
    selectItems: vi.fn()
  }
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

type ComfyAppMissingModelPipelineTarget = {
  runMissingModelPipeline: (
    graphData: ComfyWorkflowJSON,
    options?: { silent?: boolean; missingNodeTypes?: string[] }
  ) => Promise<{
    missingModels: ModelFile[]
    confirmedCandidates: MissingModelCandidate[]
  }>
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
    setActivePinia(createPinia())
    vi.clearAllMocks()
    app = new ComfyApp()
    mockCanvas = createMockCanvas() as LGraphCanvas
    app.canvas = mockCanvas as LGraphCanvas
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue(undefined)
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

  describe('refreshMissingModels', () => {
    function mockRefreshMissingModelsApp(
      graphData: ComfyWorkflowJSON,
      candidates: MissingModelCandidate[] = []
    ) {
      mockWorkspaceWorkflow.activeWorkflow = null
      Reflect.set(app, 'rootGraphInternal', {
        nodes: [],
        serialize: vi.fn(() => graphData)
      })
      vi.spyOn(app, 'reloadNodeDefs').mockResolvedValue()
      const appWithPrivate =
        app as unknown as ComfyAppMissingModelPipelineTarget
      const pipelineSpy = vi
        .spyOn(appWithPrivate, 'runMissingModelPipeline')
        .mockResolvedValue({
          missingModels: [],
          confirmedCandidates: []
        })
      useMissingModelStore().missingModelCandidates = candidates
      return pipelineSpy
    }

    it('reuses active workflow model metadata when refreshing the current graph', async () => {
      const graphData = createWorkflowGraphData()
      const activeModels = [
        {
          name: 'embedded.safetensors',
          url: 'https://example.com/embedded.safetensors',
          directory: 'checkpoints'
        }
      ]
      const pipelineSpy = mockRefreshMissingModelsApp(graphData, [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'candidate.safetensors',
          url: 'https://example.com/candidate.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        }
      ])
      mockWorkspaceWorkflow.activeWorkflow = {
        activeState: { models: activeModels }
      } as LoadedComfyWorkflow

      await app.refreshMissingModels({ silent: false })

      expect(app.reloadNodeDefs).toHaveBeenCalled()
      expect(pipelineSpy).toHaveBeenCalledWith(
        expect.objectContaining({ models: activeModels }),
        { silent: false }
      )
    })

    it('falls back to current missing model metadata when workflow state has no models', async () => {
      const graphData = createWorkflowGraphData()
      const pipelineSpy = mockRefreshMissingModelsApp(graphData, [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'candidate.safetensors',
          url: 'https://example.com/candidate.safetensors',
          directory: 'checkpoints',
          hash: 'abc123',
          hashType: 'sha256',
          isMissing: true,
          isAssetSupported: true
        },
        {
          nodeId: '2',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'missing-url.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        }
      ])

      await app.refreshMissingModels()

      expect(pipelineSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          models: [
            {
              name: 'candidate.safetensors',
              url: 'https://example.com/candidate.safetensors',
              directory: 'checkpoints',
              hash: 'abc123',
              hash_type: 'sha256'
            }
          ]
        }),
        { silent: true }
      )
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
})
