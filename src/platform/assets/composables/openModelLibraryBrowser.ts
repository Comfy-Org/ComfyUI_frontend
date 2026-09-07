import { startModelNodeDragFromAsset } from '@/composables/node/startModelNodeDragFromAsset'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

export async function openModelLibraryBrowser(): Promise<void> {
  // Silent no-op: `ComfyCommand` exposes only an `active?` toggle getter and no
  // visibility/enabled predicate, so a command gated on this flag cannot be
  // hidden or explained; adding that predicate is out of scope here.
  if (!useFeatureFlags().flags.assetsEnabled) return

  const toastStore = useToastStore()
  const assetBrowserDialog = useAssetBrowserDialog()
  await assetBrowserDialog.browse({
    assetType: 'models',
    title: t('sideToolbar.modelLibrary'),
    onAssetSelected: (asset) => {
      const error = startModelNodeDragFromAsset(asset, 'asset_browser')
      if (error) {
        reportError(new Error(error.message), {
          errorType: 'model_node_creation_failure',
          tags: { code: error.code },
          context: { assetId: error.assetId, details: error.details }
        })
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('assetBrowser.failedToCreateNode')
        })
      }
    }
  })
}
