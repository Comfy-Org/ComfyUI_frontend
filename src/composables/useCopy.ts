import { useEventListener } from '@vueuse/core'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

const clipboardHTMLWrapper = [
  '<meta charset="utf-8"><div><span data-metadata="',
  '"></span></div><span style="white-space:pre-wrap;">Text</span>'
]

/**
 * Last serialized payload written to the OS clipboard by the in-app copy
 * handler. Lets the paste handler recognize OS-clipboard metadata as
 * in-app even after later menu/command copies moved the internal
 * clipboard past it.
 */
export const LAST_COPY_EVENT_PAYLOAD_KEY =
  'Comfy.Clipboard.LastCopyEventPayload'
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

/**
 * Adds a handler on copy that serializes selected nodes to JSON
 */
export const useCopy = () => {
  const canvasStore = useCanvasStore()

  useEventListener(document, 'copy', (e) => {
    if (shouldIgnoreCopyPaste(e.target)) {
      // Default system copy
      return
    }
    // copy nodes and clear clipboard
    const canvas = canvasStore.canvas
    if (canvas?.selectedItems) {
      const serializedData = canvas.copyToClipboard()
      try {
        const base64Data = encodeClipboardData(serializedData)
        // clearData doesn't remove images from clipboard
        e.clipboardData?.setData(
          'text/html',
          clipboardHTMLWrapper.join(base64Data)
        )
        localStorage.setItem(LAST_COPY_EVENT_PAYLOAD_KEY, serializedData)
      } catch (error) {
        console.error(error)
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
