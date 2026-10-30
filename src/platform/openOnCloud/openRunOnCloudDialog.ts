import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-run-on-comfy-cloud'

/** Opens the modal for Comfy Cloud's answer; closing it dismisses that modal in the check. */
export async function openRunOnCloudDialog(): Promise<void> {
  const { default: RunOnCloudDialog } =
    await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')
  const checkStore = useCloudWorkflowCheckStore()
  if (!checkStore.isModalShown) return
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: DIALOG_KEY })
  dialogStore.showDialog({
    key: DIALOG_KEY,
    component: RunOnCloudDialog,
    props: { titleId: DIALOG_KEY, onDone: hide, onDismiss: hide },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true,
      onRemoved: () => checkStore.dismissModal()
    }
  })
}

/** Closes the modal for Comfy Cloud's answer. */
export function closeRunOnCloudDialog(): void {
  useDialogStore().closeDialog({ key: DIALOG_KEY })
}
