import { useEventListener } from '@vueuse/core'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY
} from '@/lib/litegraph/src/canvas/clipboardStorage'
import { reportError } from '@/platform/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  hasTextSelection,
  shouldIgnoreCopyPaste
} from '@/workbench/eventHelpers'

const metadataHtmlPrefix =
  '<meta charset="utf-8"><div><span data-comfy-metadata="'
const legacyMetadataHtmlPrefix =
  '<meta charset="utf-8"><div><span data-metadata="'
const metadataHtmlSuffix =
  '"></span></div><span style="white-space:pre-wrap;">Text</span>'
const chromiumHtmlWrappers = [
  { before: '', after: '' },
  { before: "<meta charset='utf-8'>", after: '' },
  {
    before: '<html>\r\n<body>\r\n<!--StartFragment-->',
    after: '<!--EndFragment-->\r\n</body>\r\n</html>'
  }
]

function clipboardHtml(base64Data: string): string {
  return `${metadataHtmlPrefix}${base64Data}${metadataHtmlSuffix}`
}

function between(text: string, before: string, after: string) {
  if (!text.startsWith(before) || !text.endsWith(after)) return undefined
  return text.slice(before.length, text.length - after.length)
}

function readMetadata(html: string): string | undefined {
  return chromiumHtmlWrappers
    .flatMap(({ before, after }) =>
      [metadataHtmlPrefix, legacyMetadataHtmlPrefix].map((prefix) =>
        between(html, before + prefix, metadataHtmlSuffix + after)
      )
    )
    .find((base64Data) => base64Data !== undefined)
}

const clipboardByteChunkSize = 0x8000

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = []

  for (
    let offset = 0;
    offset < bytes.length;
    offset += clipboardByteChunkSize
  ) {
    chunks.push(
      String.fromCharCode(
        ...bytes.subarray(offset, offset + clipboardByteChunkSize)
      )
    )
  }

  return chunks.join('')
}

function encodeClipboardData(data: string): string {
  return btoa(bytesToBinaryString(new TextEncoder().encode(data)))
}

type ClipboardHtmlParse =
  | { status: 'absent' }
  | { status: 'unreadable'; cause: unknown }
  | { status: 'read'; payload: unknown }

export function parseClipboardHtml(html: string): ClipboardHtmlParse {
  const base64Data = readMetadata(html)
  if (!base64Data) return { status: 'absent' }
  try {
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
    return {
      status: 'read',
      payload: JSON.parse(new TextDecoder().decode(bytes))
    }
  } catch (cause) {
    return { status: 'unreadable', cause }
  }
}

/**
 * Adds a handler on copy that serializes selected nodes to JSON
 */
export const useCopy = () => {
  const canvasStore = useCanvasStore()
  let keyboardCopyId: string | null = null

  useEventListener(document, 'copy', (e) => {
    if (shouldIgnoreCopyPaste(e.target)) {
      // Default system copy
      if (
        keyboardCopyId !== null &&
        hasTextSelection(e.target) &&
        localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY) === keyboardCopyId
      ) {
        localStorage.removeItem(CANVAS_CLIPBOARD_KEY)
        localStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
        keyboardCopyId = null
      }
      return
    }
    // copy nodes and clear clipboard
    const canvas = canvasStore.canvas
    if (canvas?.selectedItems) {
      const serializedData = canvas.copyToClipboard()
      keyboardCopyId = localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
      try {
        const base64Data = encodeClipboardData(
          JSON.stringify({
            ...JSON.parse(serializedData),
            clipboardId: keyboardCopyId
          })
        )
        // clearData doesn't remove images from clipboard
        e.clipboardData?.setData('text/html', clipboardHtml(base64Data))
      } catch (error) {
        reportError(error, {
          errorType: 'error_writing_clipboard_metadata',
          surface: 'graph'
        })
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
