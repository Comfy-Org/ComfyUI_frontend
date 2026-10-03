import type { CreateAssetExportData } from '@comfyorg/ingest-types'
import { useI18n } from 'vue-i18n'

import { assetService } from '@/platform/assets/services/assetService'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetExportStore } from '@/stores/assetExportStore'

export function useAssetZipExport() {
  const { t } = useI18n()
  const toast = useToastStore()

  async function startZipExport(
    request: CreateAssetExportData['body'],
    fileCount: number
  ): Promise<void> {
    try {
      const { task_id } = await assetService.createAssetExport(request)
      useAssetExportStore().trackExport(task_id)
      toast.add({
        severity: 'info',
        summary: t('exportToast.exportStarted'),
        detail: t(
          'mediaAsset.selection.exportStarted',
          { count: fileCount },
          fileCount
        ),
        life: 3000
      })
    } catch (error) {
      reportError(error, {
        errorType: 'error_exporting_assets',
        context: { count: fileCount }
      })
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('exportToast.exportFailedSingle')
      })
    }
  }

  return { startZipExport }
}
