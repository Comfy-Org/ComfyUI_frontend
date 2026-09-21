import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope } from 'vue'
import { useCopy } from './useCopy'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { fromPartial } from '@total-typescript/shoehorn'

const copyMocks = {
  canvas: {
    selectedItems: new Set<object>([{}]),
    copyToClipboard: vi.fn()
  }
}

const multiChunkPayloadLength = 0x8000 * 6 + 123
const canvasClipboardKey = 'litegrapheditor_clipboard'

function mountCopy(): void {
  const scope = effectScope()
  scope.run(useCopy)
  onTestFinished(() => scope.stop())
}

function dispatchCopy(target: EventTarget = document): DataTransfer {
  const dataTransfer = new DataTransfer()
  target.dispatchEvent(
    new ClipboardEvent('copy', { clipboardData: dataTransfer, bubbles: true })
  )

  return dataTransfer
}

function copySerializedData(serializedData: string): DataTransfer {
  copyMocks.canvas.copyToClipboard.mockReturnValue(serializedData)
  return dispatchCopy()
}

function selectDocumentText(selectedCharacters: number): void {
  const paragraph = document.createElement('p')
  const text = document.createTextNode('Transcript text')
  paragraph.append(text)
  document.body.append(paragraph)
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, selectedCharacters)
  const selection = window.getSelection()
  assert.exists(selection)
  selection.addRange(range)
  onTestFinished(() => {
    selection.removeAllRanges()
    paragraph.remove()
  })
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
    mountCopy()
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

  describe('copy on a target the canvas ignores', () => {
    const keyboardNode = '{"nodes":[{"type":"LoadImage"}]}'
    const contextMenuNode = '{"nodes":[{"type":"SaveImage"}]}'

    function copyNodeWithKeyboard(): void {
      copyMocks.canvas.copyToClipboard.mockImplementation(() => {
        localStorage.setItem(canvasClipboardKey, keyboardNode)
        return keyboardNode
      })
      dispatchCopy()
    }

    function copyNodeFromContextMenu(): void {
      localStorage.setItem(canvasClipboardKey, contextMenuNode)
    }

    beforeEach(() => {
      onTestFinished(() => localStorage.removeItem(canvasClipboardKey))
    })

    it.for([
      {
        slot: 'a keyboard node copy',
        writeSlot: [copyNodeWithKeyboard],
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: null
      },
      {
        slot: 'a keyboard node copy',
        writeSlot: [copyNodeWithKeyboard],
        selection: 'a collapsed caret',
        selectedCharacters: 0,
        slotAfter: keyboardNode
      },
      {
        slot: 'a context-menu copy',
        writeSlot: [copyNodeFromContextMenu],
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: contextMenuNode
      },
      {
        slot: 'a context-menu copy after a keyboard node copy',
        writeSlot: [copyNodeWithKeyboard, copyNodeFromContextMenu],
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: contextMenuNode
      }
    ])(
      'with $selection after $slot leaves the canvas clipboard slot as $slotAfter',
      ({ writeSlot, selectedCharacters, slotAfter }) => {
        for (const write of writeSlot) write()
        copyMocks.canvas.copyToClipboard.mockClear()
        selectDocumentText(selectedCharacters)
        const textarea = document.createElement('textarea')
        document.body.append(textarea)
        onTestFinished(() => textarea.remove())

        const dataTransfer = dispatchCopy(textarea)

        expect(localStorage.getItem(canvasClipboardKey)).toBe(slotAfter)
        expect(dataTransfer.getData('text/html')).toBe('')
        expect(copyMocks.canvas.copyToClipboard).not.toHaveBeenCalled()
      }
    )
  })
})
