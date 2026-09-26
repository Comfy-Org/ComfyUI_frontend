import DeployToComfyApiCard from '@/platform/workflow/deploy/components/DeployToComfyApiCard.vue'
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
        titleId: DIALOG_KEY,
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
