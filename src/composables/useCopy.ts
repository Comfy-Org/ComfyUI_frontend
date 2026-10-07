import { useEventListener } from '@vueuse/core'

import { reportError } from '@/platform/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createUuidv4 } from '@/utils/uuid'
import {
  hasTextSelection,
  shouldIgnoreCopyPaste
} from '@/workbench/eventHelpers'

const CANVAS_CLIPBOARD_KEY = 'litegrapheditor_clipboard'
const CANVAS_CLIPBOARD_ID_KEY = 'litegrapheditor_clipboard_id'

export const LAST_KEYBOARD_COPY_ID_KEY = 'Comfy.Clipboard.LastCopyId'

const clipboardHtmlPattern =
  /^<meta charset="utf-8"><div><span data-(?:comfy-)?metadata="([A-Za-z0-9+/=]+)"><\/span><\/div><span style="white-space:pre-wrap;">Text<\/span>$/

function clipboardHtml(base64Data: string): string {
  return `<meta charset="utf-8"><div><span data-comfy-metadata="${base64Data}"></span></div><span style="white-space:pre-wrap;">Text</span>`
}

export function readClipboardMetadata(html: string): string | undefined {
  return html.match(clipboardHtmlPattern)?.[1]
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

export function decodeClipboardData(base64Data: string): unknown {
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
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
      const lastCopyId = createUuidv4()
      try {
        localStorage.setItem(LAST_KEYBOARD_COPY_ID_KEY, lastCopyId)
      } catch (error) {
        reportError(error, {
          errorType: 'error_saving_clipboard_copy_id',
          surface: 'graph'
        })
      }
      keyboardCopyId = localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
      try {
        const base64Data = encodeClipboardData(
          JSON.stringify({ ...JSON.parse(serializedData), copyId: lastCopyId })
        )
        // clearData doesn't remove images from clipboard
        e.clipboardData?.setData('text/html', clipboardHtml(base64Data))
      } catch (error) {
        console.error(error)
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
