import { useI18n } from 'vue-i18n'

import { downloadFile, downloadFileAsBlob } from '@/base/common/downloadUtil'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useToast } from '@/components/ui/toast/toastStore'

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

function isAppRoute(url: string): boolean {
  if (url.startsWith('blob:')) return false
  const candidate = URL.parse(url, window.location.origin)
  const apiBase = URL.parse(api.apiURL(''), window.location.origin)
  if (!candidate || !apiBase) return false
  return (
    candidate.origin === window.location.origin ||
    candidate.origin === apiBase.origin
  )
}

/** A download of `url` that carries the app's authorization when the URL is one of our own routes. */
export function createFileDownload(
  url: string,
  filename: string
): AssetDownload {
  if (!isCloud || !isAppRoute(url)) return { mode: 'direct', url, filename }
  return {
    mode: 'fetch',
    url,
    filename,
    fetch: (route) => api.fetchApi(route)
  }
}

export function useAssetDownload() {
  const { t } = useI18n()
  const toast = useToast()

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
      toast.success(t('g.success'), {
        description: t('mediaAsset.selection.downloadsStarted', successCount),
        duration: 2000
      })
    }

    if (failures.length > 0) {
      for (const failure of failures) {
        reportError(failure.cause, {
          surface: 'assets',
          errorType: 'error_downloading_asset',
          context: { filename: failure.filename }
        })
      }
      toast.error(t('g.error'), {
        description: t('progressToast.downloadsFailed', failures.length)
      })
    }
  }

  return { downloadFiles }
}
