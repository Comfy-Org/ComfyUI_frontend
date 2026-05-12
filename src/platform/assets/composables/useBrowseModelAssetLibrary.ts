import { useI18n } from 'vue-i18n'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useDialogService } from '@/services/dialogService'

interface BrowseModelAssetLibraryOptions {
  /** Overrides default {@link sideToolbar.modelLibrary} title */
  title?: string
}

/**
 * Opens the model asset browser modal after the Asset API setting gate,
 * matching {@link Comfy.BrowseModelAssets} command behavior.
 */
export function useBrowseModelAssetLibrary() {
  const { t } = useI18n()
  const dialogService = useDialogService()
  const settingStore = useSettingStore()
  const workflowService = useWorkflowService()
  const toastStore = useToastStore()

  async function openBrowseModelLibrary(
    options?: BrowseModelAssetLibraryOptions
  ): Promise<void> {
    if (!settingStore.get('Comfy.Assets.UseAssetAPI')) {
      const confirmed = await dialogService.confirm({
        title: t('assetBrowser.enableAssetAPI.title'),
        message: t('assetBrowser.enableAssetAPI.message'),
        type: 'default'
      })

      if (!confirmed) return

      await settingStore.set('Comfy.Assets.UseAssetAPI', true)
      await workflowService.reloadCurrentWorkflow()
    }

    const assetBrowserDialog = useAssetBrowserDialog()
    await assetBrowserDialog.browse({
      assetType: 'models',
      title: options?.title ?? t('sideToolbar.modelLibrary'),
      onAssetSelected: (asset) => {
        const result = createModelNodeFromAsset(asset)
        if (!result.success) {
          toastStore.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('assetBrowser.failedToCreateNode')
          })
          console.error('Node creation failed:', result.error)
        }
      }
    })
  }

  return { openBrowseModelLibrary }
}
