import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-deploy-setup-to-comfy-cloud'

/** Opens the dialog for deploying this setup to Comfy Cloud. */
export async function openDeploySetupDialog(): Promise<void> {
  const { default: DeploySetupCard } =
    await import('@/platform/openOnCloud/components/DeploySetupCard.vue')
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: DIALOG_KEY })
  dialogStore.showDialog({
    key: DIALOG_KEY,
    component: DeploySetupCard,
    props: {
      titleId: DIALOG_KEY,
      videoSources: DEPLOY_VIDEO_SOURCES,
      posterSrc: DEPLOY_VIDEO_POSTER_SRC,
      onDone: hide,
      onDismiss: hide
    },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
}
