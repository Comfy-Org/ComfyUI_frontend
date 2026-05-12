import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { USER_MEDIA_ASSETS_ASSET_TYPE } from '@/platform/assets/constants/userMediaAssetsBrowse'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useDialogService } from '@/services/dialogService'

interface BrowseUserMediaAssetsLibraryOptions {
  title?: string
}

/**
 * Opens the merged user media browser (input, output, temp) after the
 * Asset API setting gate. Model-tagged assets add a loader node; other assets
 * use the same loader detection as the media sidebar.
 */
export function useBrowseUserMediaAssetsLibrary() {
  const { t } = useI18n()
  const dialogService = useDialogService()
  const settingStore = useSettingStore()
  const workflowService = useWorkflowService()
  const toastStore = useToastStore()
  const { addMultipleToWorkflow } = useMediaAssetActions()

  async function openBrowseUserMediaAssetsLibrary(
    options?: BrowseUserMediaAssetsLibraryOptions
  ): Promise<void> {
    if (!settingStore.get('Comfy.Assets.UseAssetAPI')) {
      const confirmed = await dialogService.confirm({
        title: t('assets.enableApi.title'),
        message: t('assets.enableApi.message'),
        type: 'default'
      })

      if (!confirmed) return

      await settingStore.set('Comfy.Assets.UseAssetAPI', true)
      await workflowService.reloadCurrentWorkflow()
    }

    const assetBrowserDialog = useAssetBrowserDialog()
    await assetBrowserDialog.browse({
      assetType: USER_MEDIA_ASSETS_ASSET_TYPE,
      title:
        options?.title ?? t('assetLibraryExplorer.userMediaAssetsModalTitle'),
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

  return { openBrowseUserMediaAssetsLibrary }
}
