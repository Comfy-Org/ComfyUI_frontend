import AssetBrowserDialog from '@/components/dialog/content/AssetBrowserDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { Asset } from '@/types/assetTypes'

const DIALOG_KEY = 'asset-browser-dialog'

export const useAssetBrowserDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(options?: { onSelect?: (asset: Asset) => void }) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: AssetBrowserDialog,
      props: {
        onClose: hide,
        ...(options?.onSelect && { onSelect: options.onSelect })
      }
    })
  }

  return {
    show,
    hide
  }
}
