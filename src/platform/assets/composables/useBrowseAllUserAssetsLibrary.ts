import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ALL_USER_ASSETS_ASSET_TYPE } from '@/platform/assets/constants/allUserAssetsBrowse'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useDialogService } from '@/services/dialogService'

export interface BrowseAllUserAssetsLibraryOptions {
  title?: string
}

/**
 * Opens the merged user-asset browser (input, output, models, temp) after the
 * Asset API setting gate. Model-tagged assets add a loader node; other assets
 * use the same loader detection as the media sidebar.
 */
export function useBrowseAllUserAssetsLibrary() {
  const { t } = useI18n()
  const dialogService = useDialogService()
  const settingStore = useSettingStore()
  const workflowService = useWorkflowService()
  const toastStore = useToastStore()
  const { addMultipleToWorkflow } = useMediaAssetActions()

  async function openBrowseAllUserAssetsLibrary(
    options?: BrowseAllUserAssetsLibraryOptions
  ): Promise<void> {
    if (!settingStore.get('Comfy.Assets.UseAssetAPI')) {
      const confirmed = await dialogService.confirm({
        title: 'Enable Asset API',
        message:
          'The Asset API is currently disabled. Would you like to enable it?',
        type: 'default'
      })

      if (!confirmed) return

      await settingStore.set('Comfy.Assets.UseAssetAPI', true)
      await workflowService.reloadCurrentWorkflow()
    }

    const assetBrowserDialog = useAssetBrowserDialog()
    await assetBrowserDialog.browse({
      assetType: ALL_USER_ASSETS_ASSET_TYPE,
      title:
        options?.title ?? t('assetLibraryExplorer.allUserAssetsModalTitle'),
      onAssetSelected: (asset: AssetItem) => {
        if (asset.tags?.includes(MODELS_TAG)) {
          const result = createModelNodeFromAsset(asset)
          if (!result.success) {
            toastStore.add({
              severity: 'error',
              summary: t('g.error'),
              detail: t('assetBrowser.failedToCreateNode')
            })
            console.error('Node creation failed:', result.error)
          }
          return
        }

        void addMultipleToWorkflow([asset])
      }
    })
  }

  return { openBrowseAllUserAssetsLibrary }
}
