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
import { useToast } from '@/components/ui/toast/toastStore'
import {
  copyToCanvasClipboard,
  forgetCanvasCopy
} from '@/core/graph/clipboard/canvasClipboard'
import { serializeItems } from '@/core/graph/clipboard/graphTransfer'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY
} from '@/core/graph/clipboard/clipboardStorage'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'

const copyMocks = {
  canvas: {
    selectedItems: new Set<object>([{}])
  }
}

vi.mock(import('@/core/graph/clipboard/graphTransfer'), { spy: true })

const multiChunkPayloadLength = 0x8000 * 6 + 123

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
  vi.mocked(serializeItems).mockReturnValue(JSON.parse(serializedData))
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

const releasedHtmlPrefix =
  '<meta charset="utf-8"><div><span data-comfy-metadata="'
const releasedHtmlSuffix =
  '"></span></div><span style="white-space:pre-wrap;">Text</span>'

function readClipboardPayload(dataTransfer: DataTransfer): unknown {
  const html = dataTransfer.getData('text/html')
  if (
    !html.startsWith(releasedHtmlPrefix) ||
    !html.endsWith(releasedHtmlSuffix)
  )
    throw new Error('Expected clipboard metadata to be written')

  const base64Data = html.slice(
    releasedHtmlPrefix.length,
    -releasedHtmlSuffix.length
  )
  const bytes = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

describe('useCopy', () => {
  beforeEach(() => {
    useCanvasStore().canvas = fromPartial<LGraphCanvas>(copyMocks.canvas)
    mountCopy()
    onTestFinished(forgetCanvasCopy)
  })

  it.for([
    { name: 'missing', data: () => null },
    {
      name: 'refused',
      data: () => {
        const data = new DataTransfer()
        vi.spyOn(data, 'setData').mockImplementation(() => {
          throw new Error('Clipboard refused')
        })
        return data
      }
    }
  ])(
    'reports complete copy refusal when system clipboard data is $name',
    ({ data }) => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage unavailable', 'QuotaExceededError')
      })

      document.dispatchEvent(
        new ClipboardEvent('copy', { clipboardData: data() })
      )

      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          description: 'Failed to copy to clipboard'
        })
      )
    }
  )

  it('keeps a cache-only copy successful when system clipboard data is missing', () => {
    document.dispatchEvent(new ClipboardEvent('copy'))

    expect(useToast().toasts).toEqual([])
    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).not.toBeNull()
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

    expect(readClipboardPayload(dataTransfer)).toEqual(
      JSON.parse(serializedData)
    )
  })

  it.for([
    { methods: ['setItem'], fault: 'QuotaExceededError' },
    {
      methods: ['getItem', 'setItem', 'removeItem'],
      fault: 'SecurityError'
    }
  ] satisfies {
    methods: ('getItem' | 'setItem' | 'removeItem')[]
    fault: string
  }[])(
    'writes current clipboard metadata when localStorage throws $fault',
    ({ methods, fault }) => {
      const graph = createTestRootGraph()
      const node = createTestNode(graph)
      const canvas = createTestCanvas(
        graph,
        createMockCanvasRenderingContext2D()
      )
      onTestFinished(() => canvas.unbindEvents())
      canvas.selectItems([node])
      useCanvasStore().canvas = canvas
      const spies = methods.map((method) =>
        vi.spyOn(localStorage, method).mockImplementation(() => {
          throw new DOMException('Storage unavailable', fault)
        })
      )

      try {
        const dataTransfer = dispatchCopy()

        expect(readClipboardPayload(dataTransfer)).toMatchObject({
          nodes: [{ id: Number(node.id), type: node.type }]
        })
      } finally {
        for (const spy of spies) spy.mockRestore()
      }
    }
  )

  describe('copy on a target the canvas ignores', () => {
    const keyboardNode = '{"nodes":[{"type":"LoadImage"}]}'
    const contextMenuNode = '{"nodes":[{"type":"SaveImage"}]}'
    let copyId = 0

    function writeCanvasClipboard(serializedData: string): void {
      localStorage.setItem(CANVAS_CLIPBOARD_KEY, serializedData)
      localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, String(++copyId))
    }

    function copyNodeWithKeyboard(): void {
      vi.mocked(serializeItems).mockReturnValue(JSON.parse(keyboardNode))
      dispatchCopy()
    }

    function copyNodeFromContextMenu(
      serializedData: string = contextMenuNode
    ): void {
      writeCanvasClipboard(serializedData)
    }

    beforeEach(() => {
      copyId = 0
      onTestFinished(() => {
        localStorage.removeItem(CANVAS_CLIPBOARD_KEY)
        localStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
      })
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
      },
      {
        slot: 'an equal context-menu copy after a keyboard node copy',
        writeSlot: [
          copyNodeWithKeyboard,
          () => copyNodeFromContextMenu(keyboardNode)
        ],
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: keyboardNode
      }
    ])(
      'with $selection after $slot leaves the canvas clipboard slot as $slotAfter',
      ({ writeSlot, selectedCharacters, slotAfter }) => {
        for (const write of writeSlot) write()
        vi.mocked(serializeItems).mockClear()
        selectDocumentText(selectedCharacters)
        const textarea = document.createElement('textarea')
        document.body.append(textarea)
        onTestFinished(() => textarea.remove())

        const dataTransfer = dispatchCopy(textarea)

        expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe(slotAfter)
        expect(dataTransfer.getData('text/html')).toBe('')
        expect(serializeItems).not.toHaveBeenCalled()
      }
    )

    it.for([
      {
        name: 'the keyboard copy',
        laterCopy: () => {},
        slotAfter: null
      },
      {
        name: 'a later equal context-menu copy',
        laterCopy: () => {
          const canvas = useCanvasStore().canvas
          assert.exists(canvas)
          copyToCanvasClipboard(canvas)
        },
        slotAfter: keyboardNode
      },
      {
        name: 'a later unstamped copy from another tab',
        laterCopy: () => {
          localStorage.setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
        },
        slotAfter: contextMenuNode
      }
    ])(
      'keeps ownership of $name when stamp writes fail',
      ({ laterCopy, slotAfter }) => {
        const setItem = localStorage.setItem.bind(localStorage)
        const storageSpy = vi
          .spyOn(localStorage, 'setItem')
          .mockImplementation((key, value) => {
            if (key === CANVAS_CLIPBOARD_ID_KEY)
              throw new DOMException('Storage full', 'QuotaExceededError')
            setItem(key, value)
          })
        onTestFinished(() => storageSpy.mockRestore())
        copyNodeWithKeyboard()
        laterCopy()
        const input = document.createElement('textarea')
        input.value = 'selected text'
        document.body.append(input)
        onTestFinished(() => input.remove())
        input.setSelectionRange(0, 'selected'.length)

        dispatchCopy(input)

        expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe(slotAfter)
      }
    )

    it('preserves another tab copy written before the keyboard writer returns', () => {
      const setItem = localStorage.setItem.bind(localStorage)
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        setItem(key, value)
        if (key === CANVAS_CLIPBOARD_ID_KEY) {
          setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
          setItem(CANVAS_CLIPBOARD_ID_KEY, 'other-tab-copy')
        }
      })
      copyNodeWithKeyboard()
      const input = document.createElement('textarea')
      input.value = 'selected text'
      document.body.append(input)
      onTestFinished(() => input.remove())
      input.setSelectionRange(0, 'selected'.length)

      dispatchCopy(input)

      expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe(contextMenuNode)
    })

    it.for([
      { name: 'textarea', make: () => document.createElement('textarea') },
      {
        name: 'search input',
        make: () =>
          Object.assign(document.createElement('input'), { type: 'search' })
      }
    ])(
      'clears a keyboard node copy after copying selected $name text',
      ({ make }) => {
        copyNodeWithKeyboard()
        const input = make()
        input.value = 'selected text'
        document.body.append(input)
        input.setSelectionRange(0, 'selected'.length)

        dispatchCopy(input)

        expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBeNull()
      }
    )
  })
})
