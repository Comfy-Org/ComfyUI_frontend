import UnsavedWorkDialogContent from '@/platform/workspace/components/dialogs/UnsavedWorkDialogContent.vue'
import { enqueuePrompt } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

export interface UnsavedWorkDialogOptions {
  title: string
  message: string
  itemList: string[]
  hint?: string
  denyLabel: string
  confirmLabel: string
}

const DIALOG_KEY = 'unsaved-work-before-switch'

export function showUnsavedWorkDialog(
  options: UnsavedWorkDialogOptions
): Promise<boolean | null> {
  return enqueuePrompt<boolean | null>(DIALOG_KEY, (resolve) => {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: UnsavedWorkDialogContent,
      props: {
        ...options,
        onResult: (result: boolean | null) => {
          resolve(result)
          dialogStore.closeDialog({ key: DIALOG_KEY })
        }
      },
      dialogComponentProps: {
        headless: true,
        onRemoved: () => resolve(null)
      }
    })
  })
}
