import { beforeEach, describe, expect, it, vi, onTestFinished } from 'vitest'
import { effectScope } from 'vue'
import { useCopy } from './useCopy'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { fromPartial } from '@total-typescript/shoehorn'

const copyMocks = vi.hoisted(() => ({
  canvas: {
    selectedItems: new Set<object>([{}]),
    copyToClipboard: vi.fn()
  }
}))

vi.mock(
  import('@/workbench/eventHelpers'),

  () => ({
    shouldIgnoreCopyPaste: vi.fn(() => false)
  })
)

const multiChunkPayloadLength = 0x8000 * 6 + 123

function copySerializedData(serializedData: string): DataTransfer {
  copyMocks.canvas.copyToClipboard.mockReturnValue(serializedData)

  const listenerSpy = vi.spyOn(document, 'addEventListener')
  const scope = effectScope()
  scope.run(useCopy)
  onTestFinished(() => scope.stop())

  const dataTransfer = new DataTransfer()
  const event = new ClipboardEvent('copy', {
    clipboardData: dataTransfer
  })
  const copyHandler = listenerSpy.mock.calls.find(
    ([name]) => name === 'copy'
  )?.[1]
  expect(copyHandler).toBeDefined()
  if (typeof copyHandler !== 'function')
    throw new Error('Expected copy handler to be registered')

  expect(() => copyHandler.call(document, event)).not.toThrow()

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
    useCanvasStore().canvas = fromPartial<LGraphCanvas>(copyMocks.canvas)
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
