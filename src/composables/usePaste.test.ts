import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'
import type {
  LGraphCanvas,
  LGraph,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCopy } from '@/composables/useCopy'
import { app } from '@/scripts/app'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createNode } from '@/utils/litegraphUtil'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'
import {
  cloneDataTransfer,
  pasteAudioNode,
  pasteAudioNodes,
  pasteImageNode,
  pasteImageNodes,
  pasteVideoNode,
  pasteVideoNodes,
  usePaste as usePasteImpl
} from './usePaste'

vi.mock(import('firebase/auth'))

function createMockNode(): LGraphNode {
  return createMockLGraphNode({
    pos: [0, 0],
    pasteFile: vi.fn(),
    pasteFiles: vi.fn()
  })
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

function createVideoFile(
  name: string = 'test.mp4',
  type: string = 'video/mp4'
): File {
  return new File([''], name, { type })
}

function createDataTransfer(files: File[] = []): DataTransfer {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}

function pastedClipboard(kind: 'workflow JSON' | 'an image'): DataTransfer {
  if (kind === 'an image') return createDataTransfer([createImageFile()])
  const dataTransfer = new DataTransfer()
  dataTransfer.setData(
    'text/plain',
    JSON.stringify({ version: '1.0', nodes: [], extra: {} })
  )
  return dataTransfer
}

function clipboardHtml(data: unknown, attribute = 'data-comfy-metadata') {
  const encoded = btoa(JSON.stringify(data))
  return `<meta charset="utf-8"><div><span ${attribute}="${encoded}"></span></div><span style="white-space:pre-wrap;">Text</span>`
}

function mountRichTextEditor() {
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  const paragraph = editor.appendChild(document.createElement('p'))
  const chip = paragraph.appendChild(document.createElement('span'))
  chip.contentEditable = 'false'
  const chipLabel = chip.appendChild(document.createElement('span'))
  chipLabel.textContent = 'KSampler #5'
  document.body.append(editor)
  return { editor, paragraph, chipLabel }
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

let mockCanvasStore: ReturnType<typeof useCanvasStore>

let mockWorkspaceStore: ReturnType<typeof useWorkspaceStore>
let scope: EffectScope

function usePaste() {
  scope.run(usePasteImpl)
}

afterEach(() => scope.stop())

beforeEach(() => {
  scope = effectScope()
  mockWorkspaceStore = useWorkspaceStore()
  mockCanvasStore = useCanvasStore()
  mockCanvasStore.canvas = mockCanvas
})

vi.mock(import('@/scripts/app'))

vi.mock(import('@/utils/litegraphUtil'), { spy: true })

vi.mock(import('@/workbench/eventHelpers'), { spy: true })

describe('pasteImageNode', () => {
  beforeEach(() => {
    vi.mocked(createNode).mockImplementation(vi.fn())
    vi.mocked(mockCanvas.graph!.add).mockImplementation(
      (node: LGraphNode | LGraphGroup | null) => node as LGraphNode
    )
  })

  it('should create new LoadImage node when no image node provided', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    await pasteImageNode(mockCanvas, dataTransfer.items)

    expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should use existing image node when provided', async () => {
    const mockNode = createMockNode()
    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])

    await pasteImageNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file])
  })

  it('should handle multiple image files', async () => {
    const mockNode = createMockNode()
    const file1 = createImageFile('test1.png')
    const file2 = createImageFile('test2.jpg', 'image/jpeg')
    const dataTransfer = createDataTransfer([file1, file2])

    await pasteImageNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([file1, file2])
  })

  it('should do nothing when no image files present', async () => {
    const mockNode = createMockNode()
    const dataTransfer = createDataTransfer()

    await pasteImageNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).not.toHaveBeenCalled()
    expect(mockNode.pasteFiles).not.toHaveBeenCalled()
  })

  it('should filter non-image items', async () => {
    const mockNode = createMockNode()
    const imageFile = createImageFile()
    const textFile = new File([''], 'test.txt', { type: 'text/plain' })
    const dataTransfer = createDataTransfer([textFile, imageFile])

    await pasteImageNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(imageFile)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([imageFile])
  })
})

describe('pasteImageNodes', () => {
  it('should create multiple nodes for multiple files', async () => {
    const mockNode1 = createMockNode()
    const mockNode2 = createMockNode()
    vi.mocked(createNode)
      .mockResolvedValueOnce(mockNode1)
      .mockResolvedValueOnce(mockNode2)

    const file1 = createImageFile('test1.png')
    const file2 = createImageFile('test2.jpg', 'image/jpeg')

    const result = await pasteImageNodes(mockCanvas, [file1, file2])

    expect(createNode).toHaveBeenCalledTimes(2)
    expect(createNode).toHaveBeenNthCalledWith(1, mockCanvas, 'LoadImage')
    expect(createNode).toHaveBeenNthCalledWith(2, mockCanvas, 'LoadImage')
    expect(mockNode1.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode2.pasteFile).toHaveBeenCalledWith(file2)
    expect(result).toEqual([mockNode1, mockNode2])
  })

  it('should handle empty file list', async () => {
    const result = await pasteImageNodes(mockCanvas, [])

    expect(createNode).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe('pasteAudioNode', () => {
  it('should create new LoadAudio node when no audio node provided', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    const file = createAudioFile()
    const dataTransfer = createDataTransfer([file])

    await pasteAudioNode(mockCanvas, dataTransfer.items)

    expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadAudio')
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should use existing audio node when provided', async () => {
    const mockNode = createMockNode()
    const file = createAudioFile()
    const dataTransfer = createDataTransfer([file])

    await pasteAudioNode(mockCanvas, dataTransfer.items, mockNode)

    expect(createNode).not.toHaveBeenCalled()
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should filter non-audio items', async () => {
    const mockNode = createMockNode()
    const audioFile = createAudioFile()
    const textFile = new File([''], 'test.txt', { type: 'text/plain' })
    const dataTransfer = createDataTransfer([textFile, audioFile])

    await pasteAudioNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(audioFile)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([audioFile])
  })

  it('should do nothing when no audio files present', async () => {
    const mockNode = createMockNode()
    const dataTransfer = createDataTransfer()

    await pasteAudioNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).not.toHaveBeenCalled()
    expect(mockNode.pasteFiles).not.toHaveBeenCalled()
  })
})

describe('pasteAudioNodes', () => {
  it('should create multiple nodes for multiple audio files', async () => {
    const mockNode1 = createMockNode()
    const mockNode2 = createMockNode()
    vi.mocked(createNode)
      .mockResolvedValueOnce(mockNode1)
      .mockResolvedValueOnce(mockNode2)

    const file1 = createAudioFile('file1.mp3')
    const file2 = createAudioFile('file2.wav', 'audio/wav')

    const result = await pasteAudioNodes(mockCanvas, [file1, file2])

    expect(createNode).toHaveBeenCalledTimes(2)
    expect(createNode).toHaveBeenNthCalledWith(1, mockCanvas, 'LoadAudio')
    expect(createNode).toHaveBeenNthCalledWith(2, mockCanvas, 'LoadAudio')
    expect(mockNode1.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode2.pasteFile).toHaveBeenCalledWith(file2)
    expect(result).toEqual([mockNode1, mockNode2])
  })

  it('should handle empty file list', async () => {
    const result = await pasteAudioNodes(mockCanvas, [])

    expect(createNode).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('should handle single audio file', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    const file = createAudioFile()
    const result = await pasteAudioNodes(mockCanvas, [file])

    expect(createNode).toHaveBeenCalledTimes(1)
    expect(result).toEqual([mockNode])
  })
})

describe('pasteVideoNode', () => {
  it('should create new LoadVideo node when no video node provided', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    const file = createVideoFile()
    const dataTransfer = createDataTransfer([file])

    await pasteVideoNode(mockCanvas, dataTransfer.items)

    expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadVideo')
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should use existing video node when provided', async () => {
    const mockNode = createMockNode()
    const file = createVideoFile()
    const dataTransfer = createDataTransfer([file])

    await pasteVideoNode(mockCanvas, dataTransfer.items, mockNode)

    expect(createNode).not.toHaveBeenCalled()
    expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
  })

  it('should filter non-video items', async () => {
    const mockNode = createMockNode()
    const videoFile = createVideoFile()
    const imageFile = createImageFile()
    const dataTransfer = createDataTransfer([imageFile, videoFile])

    await pasteVideoNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).toHaveBeenCalledWith(videoFile)
    expect(mockNode.pasteFiles).toHaveBeenCalledWith([videoFile])
  })

  it('should do nothing when no video files present', async () => {
    const mockNode = createMockNode()
    const dataTransfer = createDataTransfer()

    await pasteVideoNode(mockCanvas, dataTransfer.items, mockNode)

    expect(mockNode.pasteFile).not.toHaveBeenCalled()
    expect(mockNode.pasteFiles).not.toHaveBeenCalled()
  })
})

describe('pasteVideoNodes', () => {
  it('should create multiple nodes for multiple video files', async () => {
    const mockNode1 = createMockNode()
    const mockNode2 = createMockNode()
    vi.mocked(createNode)
      .mockResolvedValueOnce(mockNode1)
      .mockResolvedValueOnce(mockNode2)

    const file1 = createVideoFile('file1.mp4')
    const file2 = createVideoFile('file2.webm', 'video/webm')

    const result = await pasteVideoNodes(mockCanvas, [file1, file2])

    expect(createNode).toHaveBeenCalledTimes(2)
    expect(createNode).toHaveBeenNthCalledWith(1, mockCanvas, 'LoadVideo')
    expect(createNode).toHaveBeenNthCalledWith(2, mockCanvas, 'LoadVideo')
    expect(mockNode1.pasteFile).toHaveBeenCalledWith(file1)
    expect(mockNode2.pasteFile).toHaveBeenCalledWith(file2)
    expect(result).toEqual([mockNode1, mockNode2])
  })

  it('should handle empty file list', async () => {
    const result = await pasteVideoNodes(mockCanvas, [])

    expect(createNode).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('should handle single video file', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    const file = createVideoFile()
    const result = await pasteVideoNodes(mockCanvas, [file])

    expect(createNode).toHaveBeenCalledTimes(1)
    expect(result).toEqual([mockNode])
  })
})

describe('usePaste', () => {
  beforeEach(() => {
    mockCanvas.current_node = null
    Object.assign(mockWorkspaceStore, { shiftDown: false })
    vi.mocked(mockCanvas.graph!.add).mockImplementation(
      (node: LGraphNode | LGraphGroup | null) => node as LGraphNode
    )
  })

  it('should handle image paste', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    usePaste()

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadImage')
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should handle audio paste using createNode helper', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    usePaste()

    const file = createAudioFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadAudio')
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should paste audio onto selected LoadAudio node', async () => {
    const mockNode = createMockLGraphNode({
      is_selected: true,
      pasteFile: vi.fn(),
      pasteFiles: vi.fn()
    })
    mockCanvas.current_node = mockNode
    mockNode.previewMediaType = 'audio'

    usePaste()

    const file = createAudioFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(createNode).not.toHaveBeenCalled()
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should handle video paste', async () => {
    const mockNode = createMockNode()
    vi.mocked(createNode).mockResolvedValue(mockNode)

    usePaste()

    const file = createVideoFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'LoadVideo')
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it('should paste video onto selected LoadVideo node', async () => {
    const mockNode = createMockLGraphNode({
      is_selected: true,
      pasteFile: vi.fn(),
      pasteFiles: vi.fn()
    })
    mockCanvas.current_node = mockNode
    mockNode.previewMediaType = 'video'

    usePaste()

    const file = createVideoFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(createNode).not.toHaveBeenCalled()
      expect(mockNode.pasteFile).toHaveBeenCalledWith(file)
    })
  })

  it.for([
    { clipboard: 'workflow JSON', target: 'editor' },
    { clipboard: 'workflow JSON', target: 'paragraph' },
    { clipboard: 'an image', target: 'paragraph' }
  ] as const)(
    'pasting $clipboard into a contenteditable $target leaves the graph alone',
    ({ clipboard, target }) => {
      const editor = mountRichTextEditor()
      usePaste()

      editor[target].dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          clipboardData: pastedClipboard(clipboard)
        })
      )

      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    }
  )

  // A caret can land inside an uneditable reference chip, which then becomes
  // the paste target even though the editor still handles the paste.
  it.for(['workflow JSON', 'an image'] as const)(
    'leaves the graph alone when the editor claims %s pasted inside a chip',
    (clipboard) => {
      const editor = mountRichTextEditor()
      editor.editor.addEventListener('paste', (event) => event.preventDefault())
      usePaste()

      editor.chipLabel.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: pastedClipboard(clipboard)
        })
      )

      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    }
  )

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

  it.for([
    { version: '1.0', extra: {} },
    { version: '1.0', nodes: [] },
    { version: '1.0', nodes: {}, extra: {} }
  ])('does not load malformed workflow JSON', async (workflow) => {
    usePaste()
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', JSON.stringify(workflow))

    document.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dataTransfer })
    )

    await vi.waitFor(() => {
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).toHaveBeenCalled()
    })
  })

  it('preserves text input paste for malformed workflow JSON', async () => {
    vi.mocked(shouldIgnoreCopyPaste).mockReturnValue(false)
    usePaste()
    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', JSON.stringify({ version: '1.0' }))

    input.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        clipboardData: dataTransfer
      })
    )

    await vi.waitFor(() => {
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
    })
  })

  it.for([
    { clipboard: 'node JSON', collaborator: 'pasteFromClipboard' },
    { clipboard: 'an image', collaborator: 'createNode' }
  ] as const)(
    'pasting $clipboard while the canvas is select-only never reaches $collaborator',
    ({ clipboard, collaborator }) => {
      mockCanvas.selectOnly = true
      onTestFinished(() => {
        mockCanvas.selectOnly = false
      })
      const collaborators = {
        pasteFromClipboard: mockCanvas.pasteFromClipboard,
        createNode
      }
      usePaste()
      const dataTransfer =
        clipboard === 'an image'
          ? createDataTransfer([createImageFile()])
          : new DataTransfer()
      if (clipboard === 'node JSON') dataTransfer.setData('text/plain', '{}')

      document.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dataTransfer })
      )

      expect(collaborators[collaborator]).not.toHaveBeenCalled()
    }
  )

  it('should ignore paste when shift is down', () => {
    Object.assign(mockWorkspaceStore, { shiftDown: true })

    usePaste()

    const file = createImageFile()
    const dataTransfer = createDataTransfer([file])
    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    expect(createNode).not.toHaveBeenCalled()
  })

  it('should use existing image node when selected', () => {
    const mockNode = createMockLGraphNode({
      is_selected: true,
      pasteFile: vi.fn(),
      pasteFiles: vi.fn()
    })
    mockCanvas.current_node = mockNode
    mockNode.previewMediaType = 'image'

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

  it('should paste clipboard items that useCopy wrote', () => {
    const data = {
      nodes: [],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: []
    }
    Object.assign(mockCanvas, {
      selectedItems: new Set([{}]),
      copyToClipboard: () => JSON.stringify(data)
    })
    scope.run(useCopy)
    usePaste()
    const clipboardData = new DataTransfer()
    document.dispatchEvent(new ClipboardEvent('copy', { clipboardData }))

    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData }))

    expect(mockCanvas._deserializeItems).toHaveBeenCalledWith(
      data,
      expect.any(Object)
    )
  })

  it('accepts validated legacy data-metadata clipboard items', async () => {
    const data = { nodes: [] }
    const html = clipboardHtml(data, 'data-metadata')

    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/html', html)
    dataTransfer.setData('text/plain', 'some text')

    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(mockCanvas._deserializeItems).toHaveBeenCalledWith(
        data,
        expect.any(Object)
      )
    })
  })

  it('does not treat metadata embedded in arbitrary HTML as a Comfy clipboard', async () => {
    const encoded = btoa(JSON.stringify({ nodes: [] }))
    const html = `<article><span data-comfy-metadata="${encoded}"></span></article>`

    usePaste()
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/html', html)
    document.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dataTransfer })
    )

    await vi.waitFor(() => {
      expect(mockCanvas._deserializeItems).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).toHaveBeenCalled()
    })
  })

  it.for([
    { name: 'null payload', data: null },
    { name: 'empty object', data: {} },
    { name: 'malformed node', data: { nodes: [{ type: 'KSampler' }] } },
    { name: 'malformed group', data: { groups: [{ id: 1 }] } },
    { name: 'malformed reroute', data: { reroutes: [{ id: 1 }] } },
    { name: 'malformed link', data: { links: [{ id: 1 }] } },
    { name: 'malformed subgraph', data: { subgraphs: [{ id: 'invalid' }] } }
  ])(
    'rejects malformed Comfy metadata without stale fallback: $name',
    async ({ data }) => {
      const html = clipboardHtml(data)

      usePaste()

      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/html', html)
      dataTransfer.setData('text/plain', 'some text')

      document.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dataTransfer })
      )

      await vi.waitFor(() => {
        expect(mockCanvas._deserializeItems).not.toHaveBeenCalled()
        expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
        expect(useToastStore().add).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'error' })
        )
      })
    }
  )

  it('rejects invalid Comfy JSON without stale fallback', async () => {
    const html = `<meta charset="utf-8"><div><span data-comfy-metadata="${btoa('{')}"></span></div><span style="white-space:pre-wrap;">Text</span>`

    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/html', html)
    dataTransfer.setData('text/plain', 'some text')

    document.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dataTransfer })
    )

    await vi.waitFor(() => {
      expect(mockCanvas._deserializeItems).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should toast a deserialization error without falling back', async () => {
    const deserializeError = new Error('Paste failed')
    vi.mocked(mockCanvas._deserializeItems).mockImplementation(() => {
      throw deserializeError
    })
    const data = {
      nodes: [],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: []
    }
    const html = clipboardHtml(data)

    usePaste()

    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/html', html)
    dataTransfer.setData('text/plain', 'some text')

    const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(useToastStore().add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
    })
  })

  describe('media node selected', () => {
    function setupMediaNodeSelected() {
      mockCanvas.current_node = createMockLGraphNode({
        is_selected: true,
        previewMediaType: 'image'
      })
      scope.run(useCopy)
      usePaste()
    }

    function copyNodes(): DataTransfer {
      Object.assign(mockCanvas, {
        selectedItems: new Set([{}]),
        copyToClipboard: () => JSON.stringify({ nodes: [] })
      })
      const clipboardData = new DataTransfer()
      document.dispatchEvent(new ClipboardEvent('copy', { clipboardData }))
      return clipboardData
    }

    function paste(clipboardData: DataTransfer) {
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData }))
    }

    it('skips the default paste for node metadata without a copy id', () => {
      setupMediaNodeSelected()
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', clipboardHtml({ nodes: [] }))

      paste(clipboardData)

      expect(mockCanvas._deserializeItems).not.toHaveBeenCalled()
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
    })

    it('skips the default paste when another app replaced the clipboard', () => {
      setupMediaNodeSelected()
      copyNodes()
      const otherApp = new DataTransfer()
      otherApp.setData('text/plain', 'hello from another app')

      paste(otherApp)

      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
    })

    it('runs the default paste only for the latest copy', () => {
      setupMediaNodeSelected()
      const earlier = copyNodes()
      const latest = copyNodes()

      paste(earlier)
      expect(mockCanvas.pasteFromClipboard).not.toHaveBeenCalled()
      paste(latest)
      expect(mockCanvas.pasteFromClipboard).toHaveBeenCalledOnce()
    })
  })
})

describe('cloneDataTransfer', () => {
  it('should clone string data', () => {
    const original = new DataTransfer()
    original.setData('text/plain', 'test text')
    original.setData('text/html', '<p>test html</p>')

    const cloned = cloneDataTransfer(original)

    expect(cloned.getData('text/plain')).toBe('test text')
    expect(cloned.getData('text/html')).toBe('<p>test html</p>')
  })

  it('should preserve file identities', () => {
    const file1 = createImageFile('test1.png')
    const file2 = createImageFile('test2.jpg', 'image/jpeg')
    const original = createDataTransfer([file1, file2])

    const cloned = cloneDataTransfer(original)

    expect(Array.from(cloned.files)).toContain(file1)
    expect(Array.from(cloned.files)).toContain(file2)
  })

  it('should preserve dropEffect and effectAllowed', () => {
    const original = new DataTransfer()
    original.dropEffect = 'copy'
    original.effectAllowed = 'copyMove'

    const cloned = cloneDataTransfer(original)

    expect(cloned.dropEffect).toBe('copy')
    expect(cloned.effectAllowed).toBe('copyMove')
  })

  it('should handle empty DataTransfer', () => {
    const original = new DataTransfer()

    const cloned = cloneDataTransfer(original)

    expect(cloned.types.length).toBe(0)
    expect(cloned.files.length).toBe(0)
  })

  it('should clone both string data and files', () => {
    const file = createImageFile()
    const original = createDataTransfer([file])
    original.setData('text/plain', 'test')

    const cloned = cloneDataTransfer(original)

    expect(cloned.getData('text/plain')).toBe('test')
    expect(Array.from(cloned.files)).toContain(file)
  })
})
