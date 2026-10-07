import type { Component } from 'vue'

import { SELF_STYLED_PANEL_CONTENT_CLASS } from '@/components/ui/dialog/dialog.variants'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetBrowserModalProps } from '@/platform/assets/types/assetBrowserModalProps'
import { reportError } from '@/platform/telemetry/reportError'
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
  contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
} satisfies DialogComponentProps

let assetBrowserModalComponent: Component<AssetBrowserModalProps> | undefined

/**
 * `AssetBrowserModal.vue` pulls in the asset grid, model info panel, upload
 * flow, and their stores, so the composable cannot import it without an import
 * cycle. The app shell registers it.
 */
export function registerAssetBrowserModalComponent(
  component: Component<AssetBrowserModalProps>
) {
  assetBrowserModalComponent = component
}

export const useAssetBrowserDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function openModal(props: AssetBrowserModalProps) {
    if (!assetBrowserModalComponent) {
      reportError(
        new Error('Asset browser modal component is not registered'),
        {
          errorType: 'failure_opening_asset_browser_modal',
          surface: 'assets'
        }
      )
      return
    }
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: assetBrowserModalComponent,
      props,
      dialogComponentProps: ASSET_BROWSER_DIALOG_PROPS
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(props: ShowOptions) {
    const handleAssetSelected = (asset: AssetItem) => {
      props.onAssetSelected?.(asset)
      hide()
    }

    openModal({
      nodeType: props.nodeType,
      onSelect: handleAssetSelected,
      onClose: hide
    })
  }

  function browse(options: BrowseOptions) {
    const handleAssetSelected = (asset: AssetItem) => {
      options.onAssetSelected?.(asset)
      hide()
    }

    openModal({
      showLeftPanel: true,
      assetType: options.assetType,
      title: options.title,
      onSelect: handleAssetSelected,
      onClose: hide
    })
  }

  return { show, browse }
}
