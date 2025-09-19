import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { type DialogComponentProps, useDialogStore } from '@/stores/dialogStore'

interface AssetBrowserDialogProps {
  /** ComfyUI node type for context (e.g., 'CheckpointLoaderSimple') */
  nodeType: string
  /** Widget input name (e.g., 'ckpt_name') */
  inputName: string
  /** Current selected asset value */
  currentValue?: string
  /**
   * Callback for when an asset is selected
   * @param {string} filename - The validated filename from user_metadata.filename
   */
  onAssetSelected?: (filename: string) => void
}

export const useAssetBrowserDialog = () => {
  const dialogStore = useDialogStore()
  const dialogKey = 'global-asset-browser'

  async function show(props: AssetBrowserDialogProps) {
    const handleAssetSelected = (filename: string) => {
      props.onAssetSelected?.(filename)
      dialogStore.closeDialog({ key: dialogKey })
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
          class: 'p-0 hidden'
        },
        content: {
          class: 'p-0 m-0 h-full w-full'
        }
      }
    }

    const assets: AssetItem[] = await assetService
      .getAssetsForNodeType(props.nodeType)
      .catch((error) => {
        console.error(
          'Failed to fetch assets for node type:',
          props.nodeType,
          error
        )
        return []
      })

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        assets,
        onSelect: handleAssetSelected,
        onClose: () => dialogStore.closeDialog({ key: dialogKey })
      },
      dialogComponentProps
    })
  }

  return { show }
}
