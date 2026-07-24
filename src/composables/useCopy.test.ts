import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopy } from './useCopy'

const copyMocks = vi.hoisted(() => ({
  copyHandler: undefined as ((event: ClipboardEvent) => unknown) | undefined,
  canvas: {
    selectedItems: new Set<object>([{}]),
    copyToClipboard: vi.fn()
  }
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn(
    (
      _target: EventTarget,
      event: string,
      handler: (event: ClipboardEvent) => unknown
    ) => {
      if (event === 'copy') copyMocks.copyHandler = handler
      return vi.fn()
    }
  )
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: copyMocks.canvas
  })
}))

vi.mock('@/workbench/eventHelpers', () => ({
  shouldIgnoreCopyPaste: vi.fn(() => false)
}))

const multiChunkPayloadLength = 0x8000 * 6 + 123

function copySerializedData(serializedData: string): DataTransfer {
  copyMocks.canvas.copyToClipboard.mockReturnValue(serializedData)

  useCopy()

  const dataTransfer = new DataTransfer()
  const event = new ClipboardEvent('copy', {
    clipboardData: dataTransfer
  })
  const copyHandler = copyMocks.copyHandler
  expect(copyHandler).toBeDefined()
  if (!copyHandler) throw new Error('Expected copy handler to be registered')

  expect(() => copyHandler(event)).not.toThrow()

  return dataTransfer
}

function readSerializedClipboardMetadata(dataTransfer: DataTransfer): string {
  const match = dataTransfer
    .getData('text/html')
    .match(/data-metadata="([A-Za-z0-9+/=]+)"/)?.[1]
  expect(match).toBeDefined()
  if (!match) throw new Error('Expected clipboard metadata to be written')

  const binaryString = atob(match)
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

describe('useCopy', () => {
  beforeEach(() => {
    copyMocks.copyHandler = undefined
    copyMocks.canvas.copyToClipboard.mockReset()
  })

  it('should write large serialized node data to clipboard metadata', () => {
    const serializedData = JSON.stringify({
      nodes: [
        {
          id: 1,
          type: 'Subgraph',
          title: 'Large Subgraph',
          localized_name: '이미지 그룹 图像 🎨',
          payload: 'x'.repeat(multiChunkPayloadLength)
        }
      ],
      groups: [{ title: '预处理组 🔧' }],
      reroutes: [],
      links: [],
      subgraphs: []
    })

    const dataTransfer = copySerializedData(serializedData)

    expect(readSerializedClipboardMetadata(dataTransfer)).toBe(serializedData)
  })
})
