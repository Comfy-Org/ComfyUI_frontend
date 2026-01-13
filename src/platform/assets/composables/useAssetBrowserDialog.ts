import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useDialogStore } from '@/stores/dialogStore'
import type { DialogComponentProps } from '@/stores/dialogStore'

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

const dialogComponentProps: DialogComponentProps = {
  headless: true,
  modal: true,
  closable: true,
  pt: {
    root: {
      class: 'rounded-2xl overflow-hidden asset-browser-dialog'
    },
    header: {
      class: '!p-0 hidden'
    },
    content: {
      class: '!p-0 !m-0 h-full w-full'
    }
  }
} as const

export const useAssetBrowserDialog = () => {
  const dialogStore = useDialogStore()
  const dialogKey = 'global-asset-browser'

  async function show(props: ShowOptions) {
    const handleAssetSelected = (asset: AssetItem) => {
      props.onAssetSelected?.(asset)
      dialogStore.closeDialog({ key: dialogKey })
    }

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        onSelect: handleAssetSelected,
        onClose: () => dialogStore.closeDialog({ key: dialogKey })
      },
      dialogComponentProps
    })
  }

  async function browse(options: BrowseOptions): Promise<void> {
    const handleAssetSelected = (asset: AssetItem) => {
      options.onAssetSelected?.(asset)
      dialogStore.closeDialog({ key: dialogKey })
    }

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        showLeftPanel: true,
        assetType: options.assetType,
        title: options.title,
        onSelect: handleAssetSelected,
        onClose: () => dialogStore.closeDialog({ key: dialogKey })
      },
      dialogComponentProps
    })
  }

  return { show, browse }
}
