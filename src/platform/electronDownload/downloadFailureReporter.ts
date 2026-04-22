import * as Sentry from '@sentry/vue'

import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

/** Strip query/hash from a URL to avoid leaking tokens in reporting. */
function safeUrlParts(raw: string): { host: string; path: string } {
  try {
    const u = new URL(raw)
    return { host: u.host, path: u.pathname }
  } catch {
    return { host: 'unparseable', path: 'unparseable' }
  }
}

export function reportDownloadFailure(download: ElectronDownload) {
  const { host, path } = safeUrlParts(download.url)
  Sentry.captureException(
    new Error(
      `Electron model download failed: ${download.message ?? 'unknown reason'}`
    ),
    {
      tags: {
        feature: 'electron_download',
        error_type: 'download_failed',
        host
      },
      extra: {
        filename: download.filename,
        url_path: path,
        progress: download.progress,
        message: download.message ?? null
      }
    }
  )
}
