import { useDialogStore } from '@/stores/dialogStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { openCardDialog } from '@/platform/workspace/openCustomDeploymentDialog'

const RUN_ON_CLOUD_DIALOG_KEY = 'global-run-on-comfy-cloud'

export function closeRunOnCloudDialog(): boolean {
  const dialogStore = useDialogStore()
  if (!dialogStore.isDialogOpen(RUN_ON_CLOUD_DIALOG_KEY)) return false
  dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  return true
}

export function openRunOnCloudDialog(): Promise<boolean> {
  return openCardDialog(
    RUN_ON_CLOUD_DIALOG_KEY,
    () => import('@/platform/openOnCloud/components/RunOnCloudDialog.vue'),
    {}
  )
}

export function openDeploySetupDialog(): Promise<boolean> {
  return openCardDialog(
    RUN_ON_CLOUD_DIALOG_KEY,
    () => import('@/platform/openOnCloud/components/DeploySetupCard.vue'),
    { videoSources: DEPLOY_VIDEO_SOURCES, posterSrc: DEPLOY_VIDEO_POSTER_SRC }
  )
}
