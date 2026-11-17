import { useEventListener } from '@vueuse/core'

import { reportError } from '@comfyorg/telemetry/reportError'
import { copyToCanvasClipboard } from '@/core/graph/clipboard/canvasClipboard'
import {
  discardClipboardStorage,
  readClipboardId
} from '@/core/graph/clipboard/clipboardStorage'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { hasTextSelection } from '@/workbench/eventHelpers'

import { clipboardHtml } from './clipboardHtml'
import { shouldIgnoreCopyPaste } from './clipboardTarget'

export const useCopy = () => {
  const canvasStore = useCanvasStore()
  let keyboardCopyId: string | null = null

  useEventListener(document, 'copy', (e) => {
    if (shouldIgnoreCopyPaste(e.target)) {
      if (
        keyboardCopyId !== null &&
        hasTextSelection(e.target) &&
        readClipboardId() === keyboardCopyId
      ) {
        discardClipboardStorage()
        keyboardCopyId = null
      }
      return
    }
    const canvas = canvasStore.canvas
    if (canvas?.selectedItems) {
      const { serialized, stored } = copyToCanvasClipboard(canvas)
      keyboardCopyId = stored ? readClipboardId() : null
      try {
        e.clipboardData?.setData('text/html', clipboardHtml(serialized))
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
