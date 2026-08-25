import { useEventListener } from '@vueuse/core'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

/**
 * Identifies the copy that produced the clipboard's node metadata, so the
 * paste handler can tell an in-app copy from a payload left behind by an
 * earlier one. Only the id is stored, never the payload: a serialized
 * selection can run to megabytes against a ~5MB origin quota, and a failed
 * write would misclassify the user's own fresh copy as stale.
 */
export const LAST_COPY_ID_KEY = 'Comfy.Clipboard.LastCopyId'

const clipboardHTMLWrapper = (id: string | null) => [
  `<meta charset="utf-8"><div>${id ? `<span data-copy-id="${id}" ` : '<span '}data-metadata="`,
  '"></span></div><span style="white-space:pre-wrap;">Text</span>'
]
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
      // Persist the id before it reaches the clipboard, so the two can only
      // diverge in the safe direction: metadata without an id reads as
      // stale, whereas an id the paste handler never learned about would
      // make the user's own copy look stale.
      let copyId: string | null = null
      try {
        const id = crypto.randomUUID()
        localStorage.setItem(LAST_COPY_ID_KEY, id)
        copyId = id
      } catch (error) {
        console.error(error)
      }
      try {
        const base64Data = encodeClipboardData(serializedData)
        // clearData doesn't remove images from clipboard
        e.clipboardData?.setData(
          'text/html',
          clipboardHTMLWrapper(copyId).join(base64Data)
        )
      } catch (error) {
        console.error(error)
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
