import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { isImageNode } from '@/utils/litegraphUtil'
import { pasteImageNode, usePaste } from './usePaste'

interface MockPasteNode {
  pos: [number, number]
  pasteFile: (file: File) => void
  pasteFiles: (files: File[]) => void
  is_selected?: boolean
}

function createMockNode(options?: Partial<MockPasteNode>): MockPasteNode {
  return {
    pos: [0, 0],
    pasteFile: vi.fn<(file: File) => void>(),
    pasteFiles: vi.fn<(files: File[]) => void>(),
    ...options
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

interface MockGraph {
  add: ReturnType<typeof vi.fn>
  change: ReturnType<typeof vi.fn>
}

interface MockCanvas {
  current_node: LGraphNode | null
  graph: MockGraph
  graph_mouse: [number, number]
  pasteFromClipboard: ReturnType<typeof vi.fn>
  _deserializeItems: ReturnType<typeof vi.fn>
}

const mockGraph: MockGraph = {
  add: vi.fn(),
  change: vi.fn()
}

const mockCanvas: MockCanvas = {
  current_node: null,
  graph: mockGraph,
  graph_mouse: [100, 200],
  pasteFromClipboard: vi.fn(),
  _deserializeItems: vi.fn()
}

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
    createNode: vi.fn<(type: string) => LGraphNode | undefined>()
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

function asLGraphCanvas(canvas: MockCanvas): LGraphCanvas {
  return Object.assign(Object.create(null), canvas)
}

function asLGraphNode(node: MockPasteNode): LGraphNode {
  return Object.assign(Object.create(null), node)
}

describe('pasteImageNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGraph.add.mockImplementation((node: LGraphNode | LGraphGroup) => node)
  })

  it('should create new LoadImage node when no image node provided', () => {
    const mockNode = createMockNode()
    const createdNode = asLGraphNode(mockNode)
    vi.mocked(LiteGraph.createNode).mockReturnValue(createdNode)

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    pasteImageNode(asLGraphCanvas(mockCanvas), dataTransfer.items)

    expect(LiteGraph.createNode).toHaveBeenCalledWith('LoadImage')
    // Verify pos was set on the created node (not on mockNode since Object.assign copies)
    expect(createdNode.pos).toEqual([100, 200])
    expect(mockGraph.add).toHaveBeenCalled()
    expect(mockGraph.change).toHaveBeenCalled()
    // pasteFile was called on the node returned by graph.add
    const addedNode = mockGraph.add.mock.results[0].value
    expect(addedNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should use existing image node when provided', () => {
    const mockNode = createMockNode()
    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    pasteImageNode(asLGraphCanvas(mockCanvas), dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file])
  })

  it('should handle multiple image files', () => {
    const mockNode = createMockNode()
    const file1 = createImageFile('test1.png')
    const file2 = createImageFile('test2.jpg', 'image/jpeg')
    const dataTransfer = createDataTransfer([file1, file2])

    pasteImageNode(asLGraphCanvas(mockCanvas), dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file1, file2])
  })

  it('should do nothing when no image files present', () => {
    const mockNode = createMockNode()
    const dataTransfer = createDataTransfer()

    pasteImageNode(asLGraphCanvas(mockCanvas), dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).not.toHaveBeenCalled()
    expect(mockNode.pasteFiles).not.toHaveBeenCalled()
  })

  it('should filter non-image items', () => {
    const mockNode = createMockNode()
    const imageFile = createImageFile()
    const textFile = new File([''], 'test.txt', { type: 'text/plain' })
    const dataTransfer = createDataTransfer([textFile, imageFile])

    pasteImageNode(asLGraphCanvas(mockCanvas), dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(imageFile)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([imageFile])
  })
})

describe('usePaste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.current_node = null
    mockWorkspaceStore.shiftDown = false
    mockGraph.add.mockImplementation((node: LGraphNode | LGraphGroup) => node)
  })

  it('should handle image paste', async () => {
    const mockNode = createMockNode()
    vi.mocked(LiteGraph.createNode).mockReturnValue(asLGraphNode(mockNode))

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
    vi.mocked(LiteGraph.createNode).mockReturnValue(asLGraphNode(mockNode))

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
    const mockNode = createMockNode({ is_selected: true })
    mockCanvas.current_node = asLGraphNode(mockNode)
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
