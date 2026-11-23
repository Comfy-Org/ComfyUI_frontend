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
  discardCanvasCopy,
  forgetCanvasCopy,
  isCurrentCanvasCopy
} from '@comfyorg/litegraph/clipboard/canvasClipboard'
import { serializeItems } from '@comfyorg/litegraph/clipboard/graphTransfer'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY,
  readClipboardStorage
} from '@comfyorg/litegraph/clipboard/clipboardStorage'
import type { LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import { createTestNode } from '@comfyorg/litegraph/__fixtures__/nodeHelpers'
import { createTestRootGraph } from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'

const copyMocks = {
  canvas: {
    selectedItems: new Set<object>([{}])
  }
}

vi.mock(import('@comfyorg/litegraph/clipboard/graphTransfer'), { spy: true })

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

  it('reports serialization refusal without replacing either clipboard', () => {
    const graph = createTestRootGraph()
    const node = createTestNode(graph)
    const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    onTestFinished(() => canvas.unbindEvents())
    canvas.selectItems([node])
    useCanvasStore().canvas = canvas
    node.onSerialize = () => {
      throw new Error('Extension serializer failed')
    }
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[]}')
    const data = new DataTransfer()
    data.setData('text/plain', 'previous clipboard')

    document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data }))

    expect(data.getData('text/plain')).toBe('previous clipboard')
    expect(data.getData('text/html')).toBe('')
    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('{"nodes":[]}')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        description: 'Failed to copy to clipboard'
      })
    )
  })

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

    expect(readClipboardPayload(dataTransfer)).toMatchObject(
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
        writeSlot: copyNodeWithKeyboard,
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: null
      },
      {
        slot: 'a keyboard node copy',
        writeSlot: copyNodeWithKeyboard,
        selection: 'a collapsed caret',
        selectedCharacters: 0,
        slotAfter: expect.objectContaining({ nodes: [{ type: 'LoadImage' }] })
      },
      {
        slot: 'a context-menu copy',
        writeSlot: () => copyNodeFromContextMenu(),
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: { nodes: [{ type: 'SaveImage' }] }
      },
      {
        slot: 'a context-menu copy after a keyboard node copy',
        writeSlot: () => {
          copyNodeWithKeyboard()
          copyNodeFromContextMenu()
        },
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: { nodes: [{ type: 'SaveImage' }] }
      },
      {
        slot: 'an equal context-menu copy after a keyboard node copy',
        writeSlot: () => {
          copyNodeWithKeyboard()
          copyNodeFromContextMenu(keyboardNode)
        },
        selection: 'selected document text',
        selectedCharacters: 'Transcript'.length,
        slotAfter: expect.objectContaining({ nodes: [{ type: 'LoadImage' }] })
      }
    ])(
      'with $selection after $slot leaves the canvas clipboard slot as $slotAfter',
      ({ writeSlot, selectedCharacters, slotAfter }) => {
        writeSlot()
        vi.mocked(serializeItems).mockClear()
        selectDocumentText(selectedCharacters)
        const textarea = document.createElement('textarea')
        document.body.append(textarea)
        onTestFinished(() => textarea.remove())

        const dataTransfer = dispatchCopy(textarea)

        expect(JSON.parse(readClipboardStorage() ?? 'null')).toEqual(slotAfter)
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
        slotAfter: expect.objectContaining({ nodes: [{ type: 'LoadImage' }] })
      },
      {
        name: 'a later unstamped copy from another tab',
        laterCopy: () => {
          localStorage.setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
        },
        slotAfter: { nodes: [{ type: 'SaveImage' }] }
      }
    ])(
      'keeps ownership of $name when invalidation writes fail',
      ({ laterCopy, slotAfter }) => {
        const setItem = localStorage.setItem.bind(localStorage)
        const storageSpy = vi
          .spyOn(localStorage, 'setItem')
          .mockImplementation((key, value) => {
            if (key.startsWith(`${CANVAS_CLIPBOARD_KEY}:invalid:`))
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

        expect(JSON.parse(readClipboardStorage() ?? 'null')).toEqual(slotAfter)
      }
    )

    it('preserves another tab copy interleaved with the payload write', () => {
      const setItem = localStorage.setItem.bind(localStorage)
      let interleaved = false
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        setItem(key, value)
        if (key === CANVAS_CLIPBOARD_KEY && !interleaved) {
          interleaved = true
          setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
          setItem(CANVAS_CLIPBOARD_ID_KEY, 'other-tab-copy')
        }
      })
      const canvas = useCanvasStore().canvas
      assert.exists(canvas)
      vi.mocked(serializeItems).mockReturnValue(JSON.parse(keyboardNode))
      const copy = copyToCanvasClipboard(canvas)

      discardCanvasCopy(copy)

      expect(isCurrentCanvasCopy(contextMenuNode)).toBe(true)
    })

    it('preserves another tab copy arriving during invalidation', () => {
      const canvas = useCanvasStore().canvas
      assert.exists(canvas)
      vi.mocked(serializeItems).mockReturnValue(JSON.parse(keyboardNode))
      const copy = copyToCanvasClipboard(canvas)
      const getItem = localStorage.getItem.bind(localStorage)
      const setItem = localStorage.setItem.bind(localStorage)
      let interleaved = false
      vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
        const value = getItem(key)
        if (
          !interleaved &&
          (key === CANVAS_CLIPBOARD_KEY || key === CANVAS_CLIPBOARD_ID_KEY)
        ) {
          interleaved = true
          setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
          setItem(CANVAS_CLIPBOARD_ID_KEY, 'other-tab-copy')
        }
        return value
      })

      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        setItem(key, value)
        if (!interleaved) {
          interleaved = true
          setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
          setItem(CANVAS_CLIPBOARD_ID_KEY, 'other-tab-copy')
        }
      })

      discardCanvasCopy(copy)

      expect(isCurrentCanvasCopy(contextMenuNode)).toBe(true)
    })

    it('recognizes another tab copy arriving during failed-write cleanup', () => {
      const canvas = useCanvasStore().canvas
      assert.exists(canvas)
      const removeItem = localStorage.removeItem.bind(localStorage)
      const setItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"groups":[]}')
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        if (key === CANVAS_CLIPBOARD_KEY)
          throw new DOMException('Storage full', 'QuotaExceededError')
        setItem(key, value)
        setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
      })
      vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
        removeItem(key)
        if (key === CANVAS_CLIPBOARD_KEY)
          setItem(CANVAS_CLIPBOARD_KEY, contextMenuNode)
      })
      vi.mocked(serializeItems).mockReturnValue(JSON.parse(keyboardNode))

      copyToCanvasClipboard(canvas)

      expect(isCurrentCanvasCopy(contextMenuNode)).toBe(true)
      expect(isCurrentCanvasCopy(keyboardNode)).toBe(false)
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

        expect(readClipboardStorage()).toBeNull()
      }
    )
  })
})
