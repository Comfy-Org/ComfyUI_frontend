import { useDialogStore } from '@/stores/dialogStore'

const RUN_ON_CLOUD_DIALOG_KEY = 'global-run-on-comfy-cloud'

export function closeRunOnCloudDialog(): boolean {
  const dialogStore = useDialogStore()
  if (!dialogStore.isDialogOpen(RUN_ON_CLOUD_DIALOG_KEY)) return false
  dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  return true
}

export async function openRunOnCloudDialog(): Promise<void> {
  const { default: RunOnCloudDialog } =
    await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  dialogStore.showDialog({
    key: RUN_ON_CLOUD_DIALOG_KEY,
    component: RunOnCloudDialog,
    props: { titleId: RUN_ON_CLOUD_DIALOG_KEY, onDone: hide, onDismiss: hide },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
}
