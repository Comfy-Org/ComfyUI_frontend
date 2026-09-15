import { useI18n } from 'vue-i18n'

import { downloadFile, downloadFileAsBlob } from '@/base/common/downloadUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

interface DirectAssetDownload {
  mode: 'direct'
  url: string
  filename: string
}

export interface FetchedAssetDownload {
  mode: 'fetch'
  url: string
  filename: string
  fetch?: (url: string) => Promise<Response>
  preferResponseFilename?: boolean
}

export type AssetDownload = DirectAssetDownload | FetchedAssetDownload

export function useAssetDownload() {
  const { t } = useI18n()
  const toast = useToastStore()

  async function downloadFiles(files: AssetDownload[]): Promise<void> {
    const pending = files.map((file) => {
      try {
        if (file.mode === 'direct') {
          downloadFile(file.url, file.filename)
          return Promise.resolve()
        }
        return downloadFileAsBlob(file.url, {
          filename: file.filename,
          fetch: file.fetch,
          preferResponseFilename: file.preferResponseFilename
        })
      } catch (error) {
        return Promise.reject(error)
      }
    })
    const results = await Promise.allSettled(pending)
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
