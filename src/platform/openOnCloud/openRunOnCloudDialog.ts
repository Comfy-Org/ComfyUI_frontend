import { useDialogStore } from '@/stores/dialogStore'
import { openCardDialog } from '@/platform/workspace/openCustomDeploymentDialog'

const RUN_ON_CLOUD_DIALOG_KEY = 'global-run-on-comfy-cloud'

export function closeRunOnCloudDialog(): boolean {
  const dialogStore = useDialogStore()
  if (!dialogStore.isDialogOpen(RUN_ON_CLOUD_DIALOG_KEY)) return false
  dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  return true
}

export function openRunOnCloudDialog(
  isStillWanted: () => boolean
): Promise<boolean> {
  return openCardDialog(
    RUN_ON_CLOUD_DIALOG_KEY,
    () => import('@/platform/openOnCloud/components/RunOnCloudDialog.vue'),
    {},
    isStillWanted
  )
}
