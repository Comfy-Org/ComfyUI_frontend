import { t } from '@/i18n'
import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
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

    // Extract node type category from first asset's tags (e.g., "loras", "checkpoints")
    // Tags are ordered: ["models", "loras"] so take the second tag
    const nodeTypeCategory =
      assets[0]?.tags?.find((tag) => tag !== 'models') ?? 'models'

    const acronyms = new Set(['VAE', 'CLIP', 'GLIGEN'])
    const categoryLabel = nodeTypeCategory
      .split('_')
      .map((word) => {
        const uc = word.toUpperCase()
        return acronyms.has(uc) ? uc : word
      })
      .join(' ')

    const title = t('assetBrowser.allCategory', { category: categoryLabel })

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: props.nodeType,
        inputName: props.inputName,
        currentValue: props.currentValue,
        assets,
        title,
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

    const assets = await assetService
      .getAssetsByTag(options.assetType)
      .catch((error) => {
        console.error(
          'Failed to fetch assets for tag:',
          options.assetType,
          error
        )
        return []
      })

    dialogStore.showDialog({
      key: dialogKey,
      component: AssetBrowserModal,
      props: {
        nodeType: undefined,
        inputName: undefined,
        assets,
        showLeftPanel: true,
        title: options.title,
        onSelect: handleAssetSelected,
        onClose: () => dialogStore.closeDialog({ key: dialogKey })
      },
      dialogComponentProps
    })
  }

  return { show, browse }
}
