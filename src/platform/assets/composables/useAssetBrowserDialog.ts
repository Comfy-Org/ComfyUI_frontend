import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useDialogService } from '@/services/dialogService'
import type { DialogComponentProps } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

interface ShowOptions {
  /** ComfyUI node type for context (e.g., 'CheckpointLoaderSimple') */
  nodeType: string
  /** Widget input name (e.g., 'ckpt_name') */
  inputName: string
  /** Current selected asset value */
  currentValue?: string
  onAssetSelected?: (asset: AssetItem) => void
}

interface BrowseOptions {
  /** Asset type tag to filter by (e.g., 'models') */
  assetType: string
  /** Custom modal title (optional) */
  title?: string
  /** Called when asset selected */
  onAssetSelected?: (asset: AssetItem) => void
}

const DIALOG_KEY = 'global-asset-browser'
const ASSET_BROWSER_DIALOG_PROPS = {
  contentClass:
    'w-fit max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] border-none bg-transparent shadow-none'
} satisfies DialogComponentProps

export const useAssetBrowserDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(props: ShowOptions) {
    const handleAssetSelected = (asset: AssetItem) => {
      props.onAssetSelected?.(asset)
      hide()
    }

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        onSelect: handleAssetSelected,
        onClose: hide
      },
      dialogComponentProps: ASSET_BROWSER_DIALOG_PROPS
    })
  }

  function browse(options: BrowseOptions) {
    const handleAssetSelected = (asset: AssetItem) => {
      options.onAssetSelected?.(asset)
      hide()
    }

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: AssetBrowserModal,
      props: {
        showLeftPanel: true,
        assetType: options.assetType,
        title: options.title,
        onSelect: handleAssetSelected,
        onClose: hide
      },
      dialogComponentProps: ASSET_BROWSER_DIALOG_PROPS
    })
  }

  return { show, browse }
}
