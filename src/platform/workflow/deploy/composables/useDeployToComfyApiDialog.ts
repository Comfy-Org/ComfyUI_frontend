import DeployToComfyApiCard from '@/platform/workflow/deploy/components/DeployToComfyApiCard.vue'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-deploy-to-comfy-api'

export function useDeployToComfyApiDialog() {
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: DeployToComfyApiCard,
      props: {
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

  return { show, hide }
}
