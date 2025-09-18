import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { useDialogStore } from '@/stores/dialogStore'

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
  let onHideComplete: (() => void) | null = null

  function hide(): Promise<void> {
    return new Promise((resolve) => {
      onHideComplete = resolve
      dialogStore.animateHide({ key: dialogKey })
    })
  }

  async function show(props: AssetBrowserDialogProps) {
    const handleAssetSelected = async (assetPath: string) => {
      // Update the widget value immediately - don't wait for animation
      props.onAssetSelected?.(assetPath)
      // Then trigger the hide animation
      await hide()
    }

    // Default dialog configuration for AssetBrowserModal
    const dialogComponentProps = {
      headless: true,
      modal: true,
      closable: true,
      onAfterHide: () => {
        // Resolve the hide() promise when animation completes
        if (!onHideComplete) return

        onHideComplete()
        onHideComplete = null
      },
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

    // Fetch assets for the specific node type, fallback to empty array on error
    let assets: AssetItem[] = []
    try {
      assets = await assetService.getAssetsForNodeType(props.nodeType)
    } catch (error) {
      console.error(
        'Failed to fetch assets for node type:',
        props.nodeType,
        error
      )
    }

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        assets,
        onSelect: handleAssetSelected,
        onClose: () => hide()
      },
      dialogComponentProps
    })
  }

  return { show, hide }
}
