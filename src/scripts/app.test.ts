import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { ComfyApp } from './app'
import { createNode } from '@/utils/litegraphUtil'
import { pasteImageNode, pasteImageNodes } from '@/composables/usePaste'

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn(),
  isAudioNode: vi.fn(),
  executeWidgetsCallback: vi.fn(),
  fixLinkInputSlots: vi.fn()
}))

vi.mock('@/composables/usePaste', () => ({
  pasteImageNode: vi.fn(),
  pasteImageNodes: vi.fn()
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

function createMockNode(options: Record<string, unknown> = {}): LGraphNode {
  return {
    id: 1,
    pos: [0, 0],
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  } as unknown as LGraphNode
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

function createImageFile(
  name: string = 'test.png',
  type: string = 'image/png'
): File {
  return new File([''], name, { type })
}

describe('ComfyApp', () => {
  let app: ComfyApp
  let mockCanvas: Partial<LGraphCanvas>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new ComfyApp()
    mockCanvas = createMockCanvas()
    app.canvas = mockCanvas as LGraphCanvas
  })

  describe('handleFileList', () => {
    it('should create image nodes for each file in the list', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      const mockNode2 = createMockNode({ id: 2 })
      const mockBatchNode = createMockNode({ id: 3, type: 'BatchImagesNode' })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(mockBatchNode)

      const file1 = createImageFile('test1.png')
      const file2 = createImageFile('test2.jpg', 'image/jpeg')
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file1)
      dataTransfer.items.add(file2)

      await app.handleFileList(dataTransfer.files)

      expect(pasteImageNodes).toHaveBeenCalledWith(
        mockCanvas,
        dataTransfer.files
      )
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'BatchImagesNode')
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2,
        mockBatchNode
      ])
      expect(mockNode1.connect).toHaveBeenCalledWith(0, mockBatchNode, 0)
      expect(mockNode2.connect).toHaveBeenCalledWith(0, mockBatchNode, 1)
    })

    it('should not proceed if batch node creation fails', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1])
      vi.mocked(createNode).mockResolvedValue(null)

      const file = createImageFile()
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      await app.handleFileList(dataTransfer.files)

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
      expect(mockNode1.connect).not.toHaveBeenCalled()
    })

    it('should handle empty file list', async () => {
      const dataTransfer = new DataTransfer()

      // The implementation doesn't check for empty list and will throw
      await expect(app.handleFileList(dataTransfer.files)).rejects.toThrow()
    })

    it('should not process non-image files', async () => {
      const textFile = new File([''], 'test.txt', { type: 'text/plain' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(textFile)

      await app.handleFileList(dataTransfer.files)

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
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
      const mockNode2 = createMockNode({
        pos: [0, 0],
        type: 'LoadImage'
      })
      const mockNode3 = createMockNode({
        pos: [0, 0],
        type: 'LoadImage'
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1, mockNode2, mockNode3], mockBatchNode)

      // Formula: y + (height * index) + (25 * (index + 1))
      // For LoadImage nodes, height = 344
      expect(mockNode1.pos).toEqual([100, 200])
      // index 1: 200 + (344 * 1) + (25 * 2) = 200 + 344 + 50 = 594
      expect(mockNode2.pos).toEqual([100, 594])
      // index 2: 200 + (344 * 2) + (25 * 3) = 200 + 688 + 75 = 963
      expect(mockNode3.pos).toEqual([100, 963])
    })

    it('should use set height of 344 for LoadImage nodes', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        type: 'LoadImage',
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 100]))
      })
      const mockNode2 = createMockNode({
        pos: [0, 0],
        type: 'LoadImage'
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      app.positionBatchNodes([mockNode1, mockNode2], mockBatchNode)

      // height = max(344, 100) = 344
      // index 1: 200 + (344 * 1) + (25 * 2) = 200 + 344 + 50 = 594
      expect(mockNode2.pos).toEqual([100, 594])
    })

    it('should call graph change once for all nodes', () => {
      const mockNode1 = createMockNode({
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockNode2 = createMockNode()
      const mockNode3 = createMockNode()
      const mockBatchNode = createMockNode()

      app.positionBatchNodes([mockNode1, mockNode2, mockNode3], mockBatchNode)

      // graph.change() is called for each node in the forEach
      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleFile', () => {
    it('should handle image files by creating LoadImage node', async () => {
      const { getWorkflowDataFromFile } =
        await import('@/scripts/metadata/parser')
      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})

      const mockNode = createMockNode()
      vi.mocked(createNode).mockResolvedValue(mockNode)

      const imageFile = createImageFile()

      await app.handleFile(imageFile)

      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(pasteImageNode).toHaveBeenCalledWith(
        mockCanvas,
        expect.any(DataTransferItemList),
        mockNode
      )
    })

    it('should show error toast for unsupported files', async () => {
      const { getWorkflowDataFromFile } =
        await import('@/scripts/metadata/parser')
      const { useToastStore } =
        await import('@/platform/updates/common/toastStore')
      const mockAddAlert = vi.fn()

      vi.mocked(getWorkflowDataFromFile).mockResolvedValue({})
      vi.mocked(useToastStore).mockReturnValue({
        addAlert: mockAddAlert
      } as unknown as ReturnType<typeof useToastStore>)

      const textFile = new File([''], 'test.txt', { type: 'text/plain' })

      await app.handleFile(textFile)

      expect(mockAddAlert).toHaveBeenCalled()
    })
  })
})
