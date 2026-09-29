import DeployToComfyApiCard from '@/platform/workflow/deploy/components/DeployToComfyApiCard.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-deploy-to-comfy-api'
const MEDIA_BASE = 'https://media.comfy.org/website/comfy-api'
const VIDEO_SRC = `${MEDIA_BASE}/comfy-api-1280.webm`
const VIDEO_SRC_MP4 = `${MEDIA_BASE}/comfy-api-1280.mp4`
const POSTER_SRC = `${MEDIA_BASE}/comfy-api-poster.jpg`

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
        titleId: DIALOG_KEY,
        videoSrc: VIDEO_SRC,
        videoSrcMp4: VIDEO_SRC_MP4,
        posterSrc: POSTER_SRC,
        onDone: hide,
        onDismiss: hide
      },
      dialogComponentProps: {
        renderer: 'reka',
        dismissableMask: true,
        closeOnEscape: true,
        modal: true,
        headless: true,
        overlayClass: 'bg-black/55',
        contentClass:
          'w-[min(640px,calc(100vw-2rem))] border-none bg-transparent p-0 shadow-none sm:max-w-[640px]'
      }
    })
  }

  return { show, hide }
}
