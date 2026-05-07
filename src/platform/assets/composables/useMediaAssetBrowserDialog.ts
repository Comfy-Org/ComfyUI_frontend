import MediaAssetBrowserModal from '@/platform/assets/components/MediaAssetBrowserModal.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-media-asset-browser'

export function useMediaAssetBrowserDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function show(options?: { initialTab?: 'output' | 'input' }) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: MediaAssetBrowserModal,
      props: {
        initialTab: options?.initialTab,
        onClose: hide
      }
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show, hide }
}
