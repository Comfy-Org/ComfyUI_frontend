import { t } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { writeClipboardStorage } from '@/lib/litegraph/src/canvas/clipboardStorage'
import { useToast } from '@/components/ui/toast/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { isSelectOnly } from '@/utils/litegraphUtil'

/**
 * Composable for handling basic selection operations like copy, paste, duplicate, delete, rename
 */
export function useSelectionOperations() {
  const canvasStore = useCanvasStore()
  const toast = useToast()
  const dialogService = useDialogService()
  const titleEditorStore = useTitleEditorStore()
  const workflowStore = useWorkflowStore()

  function copySelectionToStorage(): boolean {
    const stored = writeClipboardStorage(
      JSON.stringify(app.canvas._serializeItems())
    )
    if (!stored)
      toast.error(t('g.error'), {
        description: t('clipboard.errorMessage')
      })
    return stored
  }

  const copySelection = () => {
    const canvas = app.canvas
    if (canvas.selectedItems.size === 0) {
      toast.warning(t('g.nothingToCopy'), {
        description: t('g.selectItemsToCopy'),
        duration: 3000
      })
      return
    }

    if (!copySelectionToStorage()) return
    toast.success(t('g.copied'), {
      description: t('g.itemsCopiedToClipboard'),
      duration: 2000
    })
  }

  const pasteSelection = () => {
    const canvas = app.canvas
    canvas.pasteFromClipboard({ connectInputs: false })

    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  const duplicateSelection = () => {
    const canvas = app.canvas
    if (canvas.selectedItems.size === 0) {
      toast.warning(t('g.nothingToDuplicate'), {
        description: t('g.selectItemsToDuplicate'),
        duration: 3000
      })
      return
    }

    if (!copySelectionToStorage()) return

    canvas.deselectAll()

    canvas.pasteFromClipboard({ connectInputs: false })

    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  const deleteSelection = () => {
    const canvas = app.canvas
    if (isSelectOnly(canvas)) return
    if (canvas.selectedItems.size === 0) {
      toast.warning(t('g.nothingToDelete'), {
        description: t('g.selectItemsToDelete'),
        duration: 3000
      })
      return
    }

    canvas.deleteSelected()
    canvas.setDirty(true, true)

    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }

  const renameSelection = async () => {
    const selectedItems = Array.from(canvasStore.selectedItems)

    if (selectedItems.length === 1) {
      const item = selectedItems[0]

      if (item instanceof LGraphNode) {
        titleEditorStore.titleEditorTarget = item
        return
      }

      const currentTitle = 'title' in item ? (item.title as string) : ''
      const newTitle = await dialogService.prompt({
        title: t('g.rename'),
        message: t('g.enterNewName'),
        defaultValue: currentTitle
      })

      if (newTitle && newTitle !== currentTitle) {
        if ('title' in item) {
          const titledItem = item as { title: string }
          titledItem.title = newTitle
          app.canvas.setDirty(true, true)
          workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
        }
      }
      return
    }

    if (selectedItems.length > 1) {
      const baseTitle = await dialogService.prompt({
        title: t('g.batchRename'),
        message: t('g.enterBaseName'),
        defaultValue: 'Item'
      })

      if (baseTitle) {
        selectedItems.forEach((item, index) => {
          if ('title' in item) {
            const titledItem = item as { title: string }
            titledItem.title = `${baseTitle} ${index + 1}`
          }
        })
        app.canvas.setDirty(true, true)
        workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
      }
      return
    }

    toast.warning(t('g.nothingToRename'), {
      description: t('g.selectItemsToRename'),
      duration: 3000
    })
  }

  return {
    copySelection,
    pasteSelection,
    duplicateSelection,
    deleteSelection,
    renameSelection
  }
}
