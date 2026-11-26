import UnsavedWorkDialogContent from '@/platform/workspace/components/dialogs/UnsavedWorkDialogContent.vue'
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
  const dialogStore = useDialogStore()
  return new Promise<boolean | null>((resolve) => {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: UnsavedWorkDialogContent,
      props: { ...options, onResult: resolve },
      dialogComponentProps: {
        headless: true,
        onRemoved: () => resolve(null)
      }
    })
  }).then((result) => {
    dialogStore.closeDialog({ key: DIALOG_KEY })
    return result
  })
}
