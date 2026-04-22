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

/**
 * Replace any inline URL in an error message with its host+path so tokens
 * carried in query strings (e.g. signed download URLs) aren't persisted to
 * reporting. Returns undefined for empty/missing input so callers can omit
 * the field entirely.
 */
function sanitizeMessage(message: string | undefined): string | undefined {
  if (!message) return undefined
  return message.replace(/https?:\/\/\S+/g, (url) => {
    try {
      const u = new URL(url)
      return `${u.host}${u.pathname}`
    } catch {
      return '[url]'
    }
  })
}

const FAILURE_ERROR_MESSAGE = 'Electron model download failed'

export function reportDownloadFailure(download: ElectronDownload) {
  const { host, path } = safeUrlParts(download.url)
  const sanitizedMessage = sanitizeMessage(download.message)

  Sentry.captureException(new Error(FAILURE_ERROR_MESSAGE), {
    tags: {
      feature: 'electron_download',
      error_type: 'download_failed',
      host
    },
    extra: {
      filename: download.filename,
      url_path: path,
      progress: download.progress,
      message: sanitizedMessage ?? null
    },
    // Stable grouping keyed on host + sanitized reason so Sentry issues don't
    // fragment across every signed URL or random error string.
    fingerprint: [
      'electron-download-failure',
      host,
      sanitizedMessage ?? 'unknown'
    ]
  })
}
