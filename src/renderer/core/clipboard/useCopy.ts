import { useEventListener } from '@vueuse/core'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import {
  copyToCanvasClipboard,
  discardCanvasCopy,
  forgetCanvasCopy
} from '@comfyorg/litegraph/clipboard/canvasClipboard'
import { t } from '@/i18n'
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
  let keyboardCopy: ReturnType<typeof copyToCanvasClipboard> | undefined

  useEventListener(document, 'copy', (e) => {
    if (shouldIgnoreCopyPaste(e.target)) {
      if (hasTextSelection(e.target)) {
        discardCanvasCopy(keyboardCopy)
        forgetCanvasCopy()
        keyboardCopy = undefined
      }
      return
    }
    const canvas = canvasStore.canvas
    if (canvas?.selectedItems) {
      const copy = copyToCanvasClipboard(canvas)
      const { serialized, stored } = copy
      if (serialized === undefined) {
        useToast().error(t('g.error'), {
          description: t('clipboard.errorMessage')
        })
        return
      }
      keyboardCopy = copy
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
