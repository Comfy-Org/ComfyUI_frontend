import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import { useDialogStore } from '@/stores/dialogStore'

interface AssetBrowserDialogProps {
  /** ComfyUI node type for context (e.g., 'CheckpointLoaderSimple') */
  nodeType: string
  /** Widget input name (e.g., 'ckpt_name') */
  inputName: string
  /** Current selected asset value */
  currentValue?: string
  /** Callback for when an asset is selected */
  onAssetSelected?: (assetPath: string) => void
}

export const useAssetBrowserDialog = () => {
  const dialogStore = useDialogStore()
  const dialogKey = 'global-asset-browser'

  function hide() {
    dialogStore.closeDialog({ key: dialogKey })
  }

  function show(props: AssetBrowserDialogProps) {
    const handleAssetSelected = (assetPath: string) => {
      props.onAssetSelected?.(assetPath)
      hide() // Auto-close on selection
    }

    const handleClose = () => {
      hide()
    }

    // Default dialog configuration for AssetBrowserModal
    const dialogComponentProps = {
      headless: true,
      modal: true,
      closable: false,
      pt: {
        root: {
          class: 'rounded-2xl overflow-hidden'
        },
        header: {
          class: 'p-0 hidden'
        },
        content: {
          class: 'p-0 m-0 h-full w-full'
        }
      }
    }

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        onSelect: handleAssetSelected,
        onClose: handleClose
      },
      dialogComponentProps
    })
  }

  return { show, hide }
}
