import { startModelNodeDragFromAsset } from '@/platform/assets/integration/startModelNodeDragFromAsset'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'

export async function openModelLibraryBrowser(): Promise<void> {
  if (!useFeatureFlags().flags.assetsEnabled) return

  const toast = useToast()
  const assetBrowserDialog = useAssetBrowserDialog()
  await assetBrowserDialog.browse({
    assetType: 'models',
    title: t('sideToolbar.modelLibrary'),
    onAssetSelected: (asset) => {
      const error = startModelNodeDragFromAsset(asset, 'asset_browser')
      if (!error) return

      const noProvider = error.code === 'NO_PROVIDER'
      reportError(new Error(error.message), {
        surface: 'assets',
        errorType: 'model_node_creation_failure',
        tags: { code: error.code },
        context: { assetId: error.assetId, details: error.details },
        ...(noProvider && { level: 'warning', sentryMode: 'never' })
      })
      if (noProvider) {
        toast.warning(t('assetBrowser.errorModelTypeNotSupported'), {
          description: t('assetBrowser.modelTypeNotAddable')
        })
        return
      }
      toast.error(t('g.error'), {
        description: t('assetBrowser.failedToCreateNode')
      })
    }
  })
}
