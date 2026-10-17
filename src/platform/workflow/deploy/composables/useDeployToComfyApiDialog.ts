import DeployToComfyApiCard from '@/platform/workflow/deploy/components/DeployToComfyApiCard.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-deploy-to-comfy-api'
const MEDIA_BASE = 'https://media.comfy.org/website/comfy-api'
const VIDEO_SOURCES = [
  { src: `${MEDIA_BASE}/comfy-api-1280.webm`, type: 'video/webm' },
  { src: `${MEDIA_BASE}/comfy-api-1280.mp4`, type: 'video/mp4' }
]
const POSTER_SRC = `${MEDIA_BASE}/comfy-api-poster.jpg`

export interface DeployToComfyApiDialogOptions {
  deploysInstallation?: boolean
}

export function useDeployToComfyApiDialog() {
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show({ deploysInstallation }: DeployToComfyApiDialogOptions = {}) {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: DeployToComfyApiCard,
      props: {
        videoSources: VIDEO_SOURCES,
        posterSrc: POSTER_SRC,
        deploysInstallation,
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
