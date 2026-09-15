import { useI18n } from 'vue-i18n'

import { downloadFileAsBlob } from '@/base/common/downloadUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

export function useAssetDownload() {
  const { t } = useI18n()
  const toast = useToastStore()

  async function downloadFiles(
    files: {
      url: string
      filename: string
      fetch?: (url: string) => Promise<Response>
    }[]
  ): Promise<void> {
    const results = await Promise.allSettled(
      files.map(({ url, filename, fetch }) =>
        downloadFileAsBlob(url, filename, fetch)
      )
    )
    const failures = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [{ cause: result.reason, filename: files[index].filename }]
        : []
    )
    const successCount = files.length - failures.length

    if (successCount > 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.downloadsStarted', successCount),
        life: 2000
      })
    }

    if (failures.length > 0) {
      for (const failure of failures) {
        reportError(failure.cause, {
          errorType: 'error_downloading_asset',
          context: { filename: failure.filename }
        })
      }
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('progressToast.downloadsFailed', failures.length)
      })
    }
  }

  return { downloadFiles }
}
