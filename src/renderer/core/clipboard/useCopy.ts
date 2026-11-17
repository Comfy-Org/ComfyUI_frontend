import { useEventListener } from '@vueuse/core'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import {
  copyToCanvasClipboard,
  forgetCanvasCopy
} from '@/core/graph/clipboard/canvasClipboard'
import { t } from '@/i18n'
import {
  discardClipboardStorage,
  readClipboardId
} from '@/core/graph/clipboard/clipboardStorage'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { hasTextSelection } from '@/workbench/eventHelpers'

import { clipboardHtml } from './clipboardHtml'
import { shouldIgnoreCopyPaste } from './clipboardTarget'

function writeClipboardMetadata(
  data: DataTransfer | null,
  serialized: string
): boolean {
  if (!data) return false
  try {
    data.setData('text/html', clipboardHtml(serialized))
    return true
  } catch (error) {
    reportError(error, {
      errorType: 'error_writing_clipboard_metadata',
      surface: 'graph'
    })
    return false
  }
}

export const useCopy = () => {
  const canvasStore = useCanvasStore()
  let keyboardCopyId: string | null = null

  useEventListener(document, 'copy', (e) => {
    if (shouldIgnoreCopyPaste(e.target)) {
      if (hasTextSelection(e.target)) forgetCanvasCopy()
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
      const metadataWritten = writeClipboardMetadata(
        e.clipboardData,
        serialized
      )
      if (!stored && !metadataWritten) {
        forgetCanvasCopy()
        useToast().error(t('g.error'), {
          description: t('clipboard.errorMessage')
        })
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return false
    }
  })
}
