import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type {
  LGraphCanvas,
  LGraph,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { isImageNode } from '@/utils/litegraphUtil'
import { pasteImageNode, usePaste } from './usePaste'

function createMockNode() {
  return {
    pos: [0, 0],
    pasteFile: vi.fn(),
    pasteFiles: vi.fn()
  }
}

function createImageFile(
  name: string = 'test.png',
  type: string = 'image/png'
): File {
  return new File([''], name, { type })
}

function createAudioFile(
  name: string = 'test.mp3',
  type: string = 'audio/mpeg'
): File {
  return new File([''], name, { type })
}

function createDataTransfer(files: File[] = []): DataTransfer {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}

const mockCanvas = {
  current_node: null as LGraphNode | null,
  graph: {
    add: vi.fn(),
    change: vi.fn()
  } as Partial<LGraph> as LGraph,
  graph_mouse: [100, 200],
  pasteFromClipboard: vi.fn(),
  _deserializeItems: vi.fn()
} as Partial<LGraphCanvas> as LGraphCanvas

const mockCanvasStore = {
  canvas: mockCanvas,
  getCanvas: vi.fn(() => mockCanvas)
}

const mockWorkspaceStore = {
  shiftDown: false
}

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn((target, event, handler) => {
    target.addEventListener(event, handler)
    return () => target.removeEventListener(event, handler)
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mockWorkspaceStore
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn()
  }
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: {
    createNode: vi.fn()
  }
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isAudioNode: vi.fn(),
  isImageNode: vi.fn(),
  isVideoNode: vi.fn()
}))

vi.mock('@/workbench/eventHelpers', () => ({
  shouldIgnoreCopyPaste: vi.fn()
}))

describe('pasteImageNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockCanvas.graph!.add).mockImplementation(
      (node: LGraphNode | LGraphGroup) => node as LGraphNode
    )
  })

  it('should create new LoadImage node when no image node provided', () => {
    const mockNode = createMockNode()
    vi.mocked(LiteGraph.createNode).mockReturnValue(
      mockNode as unknown as LGraphNode
    )

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    pasteImageNode(mockCanvas as unknown as LGraphCanvas, dataTransfer.items)

    expect(LiteGraph.createNode).toHaveBeenCalledWith('LoadImage')
    expect(mockNode.pos).toEqual([100, 200])
    expect(mockCanvas.graph!.add).toHaveBeenCalledWith(mockNode)
    expect(mockCanvas.graph!.change).toHaveBeenCalled()
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should use existing image node when provided', () => {
    const mockNode = createMockNode()
    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    pasteImageNode(
      mockCanvas as unknown as LGraphCanvas,
      dataTransfer.items,
      mockNode as unknown as LGraphNode
    )

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file])
  })

  it('should handle multiple image files', () => {
    const mockNode = createMockNode()
    const file1 = createImageFile('test1.png')
    const file2 = createImageFile('test2.jpg', 'image/jpeg')
    const dataTransfer = createDataTransfer([file1, file2])

    pasteImageNode(
      mockCanvas as unknown as LGraphCanvas,
      dataTransfer.items,
      mockNode as unknown as LGraphNode
    )

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file1, file2])
  })

  it('should do nothing when no image files present', () => {
    const mockNode = createMockNode()
    const dataTransfer = createDataTransfer()

    pasteImageNode(
      mockCanvas as unknown as LGraphCanvas,
      dataTransfer.items,
      mockNode as unknown as LGraphNode
    )

    expect(mockNode.pasteFile).not.toHaveBeenCalled()
    expect(mockNode.pasteFiles).not.toHaveBeenCalled()
  })

  it('should filter non-image items', () => {
    const mockNode = createMockNode()
    const imageFile = createImageFile()
    const textFile = new File([''], 'test.txt', { type: 'text/plain' })
    const dataTransfer = createDataTransfer([textFile, imageFile])

    pasteImageNode(
      mockCanvas as unknown as LGraphCanvas,
      dataTransfer.items,
      mockNode as unknown as LGraphNode
    )

    expect(mockNode.pasteFile).toHaveBeenCalledWith(imageFile)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([imageFile])
  })
})

describe('usePaste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.current_node = null
    mockWorkspaceStore.shiftDown = false
    vi.mocked(mockCanvas.graph!.add).mockImplementation(
      (node: LGraphNode | LGraphGroup) => node as LGraphNode
    )
  })

  it('should handle image paste', async () => {
    const mockNode = createMockNode()
    vi.mocked(LiteGraph.createNode).mockReturnValue(
      mockNode as unknown as LGraphNode
    )

    usePaste()

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(LiteGraph.createNode).toHaveBeenCalledWith('LoadImage')
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should handle audio paste', async () => {
    const mockNode = createMockNode()
    vi.mocked(LiteGraph.createNode).mockReturnValue(
      mockNode as unknown as LGraphNode
    )

    usePaste()

    const file = createAudioFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(LiteGraph.createNode).toHaveBeenCalledWith('LoadAudio')
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should handle workflow JSON paste', async () => {
    const workflow = { version: '1.0', nodes: [], extra: {} }

    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', JSON.stringify(workflow))

    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(app.loadGraphData).toHaveBeenCalledWith(workflow)
    })
  })

  it('should ignore paste when shift is down', () => {
    mockWorkspaceStore.shiftDown = true

    usePaste()

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    expect(LiteGraph.createNode).not.toHaveBeenCalled()
  })

  it('should use existing image node when selected', () => {
    const mockNode = {
      is_selected: true,
      pasteFile: vi.fn(),
      pasteFiles: vi.fn()
    } as unknown as Partial<LGraphNode> as LGraphNode
    mockCanvas.current_node = mockNode
    vi.mocked(isImageNode).mockReturnValue(true)

    usePaste()

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should call canvas pasteFromClipboard for non-workflow text', () => {
    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'just some text')

    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    expect(mockCanvas.pasteFromClipboard).toHaveBeenCalled()
  })

  it('should handle clipboard items with metadata', async () => {
    const data = { test: 'data' }
    const encoded = btoa(JSON.stringify(data))
    const html = `<div data-metadata="${encoded}"></div>`

    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/html', html)

    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(mockCanvas._deserializeItems).toHaveBeenCalledWith(
        data,
        expect.any(Object)
      )
    })
  })
})
