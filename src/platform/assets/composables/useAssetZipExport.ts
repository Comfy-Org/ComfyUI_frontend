import type { CreateAssetExportData } from '@comfyorg/ingest-types'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { assetService } from '@/platform/assets/services/assetService'
import { reportError } from '@/platform/telemetry/reportError'
import { useAssetExportStore } from '@/stores/assetExportStore'

export function useAssetZipExport() {
  const { t } = useI18n()
  const toast = useToast()

  async function startZipExport(
    request: CreateAssetExportData['body'],
    fileCount: number
  ): Promise<void> {
    try {
      const { task_id } = await assetService.createAssetExport(request)
      useAssetExportStore().trackExport(task_id)
      toast.info(t('exportToast.exportStarted'), {
        description: t(
          'mediaAsset.selection.exportStarted',
          { count: fileCount },
          fileCount
        ),
        duration: 3000
      })
    } catch (error) {
      reportError(error, {
        errorType: 'error_exporting_assets',
        surface: 'assets',
        context: { count: fileCount }
      })
      toast.error(t('g.error'), {
        description: t('exportToast.exportFailedSingle')
      })
    }
  }

  return { startZipExport }
}
