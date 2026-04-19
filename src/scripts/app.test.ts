import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { ComfyApp, sanitizeNodeName } from './app'
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

const mockExecutionStore = vi.hoisted(() => ({
  executingNodeId: null as string | null,
  _executingNodeProgress: null as unknown
}))

const mockExecutionErrorStore = vi.hoisted(() => ({
  lastNodeErrors: null as Record<string, unknown> | null,
  lastExecutionError: null as Record<string, unknown> | null,
  showErrorOverlay: vi.fn()
}))

const mockExtensionService = vi.hoisted(() => ({
  invokeExtensions: vi.fn()
}))

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn()
}))

const mockWorkspaceStore = vi.hoisted(() => ({
  shiftDown: false
}))

const mockWidgetStore = vi.hoisted(() => ({
  widgets: new Map<string, unknown>()
}))

const mockExtensionStore = vi.hoisted(() => ({
  extensions: [] as unknown[]
}))

const mockMissingNodesErrorStore = vi.hoisted(() => ({
  surfaceMissingNodes: vi.fn()
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
  useToastStore: vi.fn(() => ({
    addAlert: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  }))
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => mockExecutionStore)
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: vi.fn(() => mockExecutionErrorStore)
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => mockExtensionService)
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => mockWorkspaceStore)
}))

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: vi.fn(() => mockWidgetStore)
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: vi.fn(() => mockExtensionStore)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/nodeReplacement/missingNodesErrorStore', () => ({
  useMissingNodesErrorStore: vi.fn(() => mockMissingNodesErrorStore)
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

describe('ComfyApp', () => {
  let app: ComfyApp
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    app = new ComfyApp()
    mockCanvas = createMockCanvas() as LGraphCanvas
    app.canvas = mockCanvas as LGraphCanvas
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

  describe('sanitizeNodeName', () => {
    it('strips dangerous HTML entities from node names', () => {
      expect(sanitizeNodeName('a&b<c>d"e\'f`g=h')).toBe('abcdefgh')
    })

    it('returns the string unchanged when no entities are present', () => {
      expect(sanitizeNodeName('KSampler')).toBe('KSampler')
    })

    it('handles empty string', () => {
      expect(sanitizeNodeName('')).toBe('')
    })
  })

  describe('getPreviewFormatParam', () => {
    it('returns preview param when format is set', () => {
      mockSettingStore.get.mockReturnValue('jpeg')
      expect(app.getPreviewFormatParam()).toBe('&preview=jpeg')
    })

    it('returns empty string when no format is configured', () => {
      mockSettingStore.get.mockReturnValue('')
      expect(app.getPreviewFormatParam()).toBe('')
    })
  })

  describe('getRandParam', () => {
    it('returns a cache-bust param in non-cloud mode', () => {
      const result = app.getRandParam()
      expect(result).toMatch(/^&rand=0\.\d+$/)
    })
  })

  describe('onClipspaceEditorClosed', () => {
    it('resets clipspace_return_node to null', () => {
      ComfyApp.clipspace_return_node = {} as never
      ComfyApp.onClipspaceEditorClosed()
      expect(ComfyApp.clipspace_return_node).toBeNull()
    })
  })

  describe('nodeOutputs setter', () => {
    it('does not invoke extensions when vueAppReady is false', () => {
      app.vueAppReady = false
      app.nodeOutputs = { '1': { images: [] } }
      expect(mockExtensionService.invokeExtensions).not.toHaveBeenCalled()
    })

    it('invokes onNodeOutputsUpdated when vueAppReady is true', () => {
      app.vueAppReady = true
      const outputs = { '1': { images: [] } }
      app.nodeOutputs = outputs
      expect(mockExtensionService.invokeExtensions).toHaveBeenCalledWith(
        'onNodeOutputsUpdated',
        outputs
      )
    })
  })

  describe('deprecated getters', () => {
    it('lastNodeErrors delegates to executionErrorStore', () => {
      const errors = { '1': { errors: [], dependent_outputs: [] } }
      mockExecutionErrorStore.lastNodeErrors = errors
      expect(app.lastNodeErrors).toBe(errors)
    })

    it('lastExecutionError delegates to executionErrorStore', () => {
      const error = { prompt_id: '1', node_id: '2', node_type: 'KSampler' }
      mockExecutionErrorStore.lastExecutionError = error
      expect(app.lastExecutionError).toBe(error)
    })

    it('runningNodeId delegates to executionStore', () => {
      mockExecutionStore.executingNodeId = '42'
      expect(app.runningNodeId).toBe('42')
    })

    it('storageLocation always returns server', () => {
      expect(app.storageLocation).toBe('server')
    })

    it('isNewUserSession always returns false', () => {
      expect(app.isNewUserSession).toBe(false)
    })

    it('shiftDown delegates to workspaceStore', () => {
      mockWorkspaceStore.shiftDown = true
      expect(app.shiftDown).toBe(true)
    })

    it('widgets converts Map to plain object', () => {
      mockWidgetStore.widgets = new Map([['INT', { name: 'INT' }]])
      expect(app.widgets).toEqual({ INT: { name: 'INT' } })
    })

    it('extensions delegates to extensionStore', () => {
      const exts = [{ name: 'test-ext' }]
      mockExtensionStore.extensions = exts
      expect(app.extensions).toBe(exts)
    })

    it('progress delegates to executionStore', () => {
      const prog = { value: 5, max: 10 }
      mockExecutionStore._executingNodeProgress = prog
      expect(app.progress).toBe(prog)
    })
  })

  describe('showMissingNodesError', () => {
    it('shows error overlay when surfaceMissingNodes returns true', () => {
      mockMissingNodesErrorStore.surfaceMissingNodes.mockReturnValue(true)

      // Access private method via bracket notation
      ;(
        app as unknown as { showMissingNodesError: Function }
      ).showMissingNodesError([
        { type: 'CustomNode', nodeId: '1', isReplaceable: false }
      ])

      expect(mockMissingNodesErrorStore.surfaceMissingNodes).toHaveBeenCalled()
      expect(mockExecutionErrorStore.showErrorOverlay).toHaveBeenCalled()
    })

    it('does not show error overlay when surfaceMissingNodes returns false', () => {
      mockMissingNodesErrorStore.surfaceMissingNodes.mockReturnValue(false)

      ;(
        app as unknown as { showMissingNodesError: Function }
      ).showMissingNodesError([
        { type: 'CustomNode', nodeId: '1', isReplaceable: false }
      ])

      expect(mockExecutionErrorStore.showErrorOverlay).not.toHaveBeenCalled()
    })
  })

  describe('isApiJson', () => {
    it('returns true for valid API workflow data', () => {
      const data = {
        '1': { class_type: 'KSampler', inputs: { seed: 42 } },
        '2': { class_type: 'CLIPTextEncode', inputs: { text: 'hello' } }
      }
      expect(app.isApiJson(data)).toBe(true)
    })

    it('returns false for empty object', () => {
      expect(app.isApiJson({})).toBe(false)
    })

    it('returns false for arrays', () => {
      expect(app.isApiJson([1, 2, 3])).toBe(false)
    })

    it('returns false for non-objects', () => {
      expect(app.isApiJson('string')).toBe(false)
      expect(app.isApiJson(42)).toBe(false)
      expect(app.isApiJson(null)).toBe(false)
    })

    it('returns false when a node lacks class_type', () => {
      const data = { '1': { inputs: { seed: 42 } } }
      expect(app.isApiJson(data)).toBe(false)
    })

    it('returns false when inputs is an array instead of object', () => {
      const data = { '1': { class_type: 'KSampler', inputs: [1, 2] } }
      expect(app.isApiJson(data)).toBe(false)
    })
  })

  describe('isGraphReady', () => {
    it('returns false before graph initialization', () => {
      const freshApp = new ComfyApp()
      expect(freshApp.isGraphReady).toBe(false)
    })
  })

  describe('configuringGraph', () => {
    it('returns false by default', () => {
      expect(app.configuringGraph).toBe(false)
    })
  })

  describe('positionNodes', () => {
    it('does nothing for single node', () => {
      const node = createMockNode({ pos: [100, 200] })
      app.positionNodes([node])
      expect(node.pos).toEqual([100, 200])
    })

    it('stacks multiple nodes vertically', () => {
      const node1 = createMockNode({
        pos: [100, 200],
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const node2 = createMockNode({ pos: [0, 0] })
      const node3 = createMockNode({ pos: [0, 0] })

      app.positionNodes([node1, node2, node3])

      expect(node1.pos).toEqual([100, 200])
      expect(node2.pos).toEqual([100, 400])
      expect(node3.pos).toEqual([100, 575])
    })
  })

  describe('clientPosToCanvasPos / canvasPosToClientPos', () => {
    it('throws when called before setup', () => {
      const freshApp = new ComfyApp()
      expect(() => freshApp.clientPosToCanvasPos([0, 0])).toThrow(
        'clientPosToCanvasPos called before setup'
      )
      expect(() => freshApp.canvasPosToClientPos([0, 0])).toThrow(
        'canvasPosToClientPos called before setup'
      )
    })
  })
})
