/**
 * Utility functions for downloading files
 */
import { t } from '@/i18n'
// oxlint-disable-next-line comfy/no-restricted-paths
import { isCloud } from '@/platform/distribution/types'
import { useToast } from '@/components/ui/toast/toastStore'
import type { AuthCredential } from '@comfyorg/api-client/authTypes'
import { getErrorMessage } from '@comfyorg/shared-frontend-utils/errorUtil'
import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'
import { useTelemetry } from '@comfyorg/telemetry'
import type { AssetDownloadMetadata } from '@comfyorg/telemetry/types'

// Constants
const DEFAULT_DOWNLOAD_FILENAME = 'download.png'

/**
 * Trigger a download by creating a temporary anchor element
 * @param href - The URL or blob URL to download
 * @param filename - The filename to suggest to the browser
 */
function triggerLinkDownload(href: string, filename: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Download a file from a URL by creating a temporary anchor element
 * @param url - The URL of the file to download (must be a valid URL string)
 * @param filename - Optional filename override (will use URL filename or default if not provided)
 * @param surface - The UI surface that started the download, for telemetry
 * @throws {Error} If the URL is invalid or empty
 */
export function downloadFile(
  url: string,
  filename?: string,
  surface = 'unknown'
): void {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Invalid URL provided for download')
  }

  const inferredFilename =
    filename || extractFilenameFromUrl(url) || DEFAULT_DOWNLOAD_FILENAME

  if (isCloud) {
    // Assets from cross-origin (e.g., GCS) cannot be downloaded this way
    void downloadFileAsBlob(url, { filename: inferredFilename, surface }).catch(
      (error) => {
        console.error('Failed to download file', error)
      }
    )
    return
  }

  triggerLinkDownload(url, inferredFilename)
}

/**
 * Download a Blob by creating a temporary object URL and anchor element
 * @param filename - The filename to suggest to the browser
 * @param blob - The Blob to download
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  triggerLinkDownload(url, filename)

  // Revoke on the next microtask to give the browser time to start the download
  queueMicrotask(() => URL.revokeObjectURL(url))
}

/**
 * Extract filename from a URL's query parameters
 * @param url - The URL to extract filename from
 * @returns The extracted filename or null if not found
 */
const extractFilenameFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.searchParams.get('filename')
  } catch {
    return null
  }
}

/**
 * Extract filename from Content-Disposition header
 * Handles both simple format: attachment; filename="name.png"
 * And RFC 5987 format: attachment; filename="fallback.png"; filename*=UTF-8''encoded%20name.png
 * @param header - The Content-Disposition header value
 * @returns The extracted filename or null if not found
 */
export function extractFilenameFromContentDisposition(
  header: string | null
): string | null {
  if (!header) return null

  // Try RFC 5987 extended format first (filename*=UTF-8''...)
  const extendedMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (extendedMatch?.[1]) {
    try {
      return decodeURIComponent(extendedMatch[1])
    } catch {
      // Fall through to simple format
    }
  }

  // Try simple quoted format: filename="..."
  const quotedMatch = header.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  // Try unquoted format: filename=...
  const unquotedMatch = header.match(/filename=([^;\s]+)/i)
  if (unquotedMatch?.[1]) {
    return unquotedMatch[1]
  }

  return null
}

class FetchStatusError extends Error {
  constructor(
    url: string,
    readonly status: number
  ) {
    super(`Failed to fetch ${url}: ${status}`)
  }
}

/**
 * Fetch a URL and return its body as a Blob.
 * Shared by download and open-in-new-tab cloud paths.
 */
async function fetchAsBlob(
  url: string,
  fetchFile: (url: string) => Promise<Response> = fetch
): Promise<Response> {
  const response = await fetchFile(url)
  if (!response.ok) {
    throw new FetchStatusError(url, response.status)
  }
  return response
}

type DownloadFailure = Pick<AssetDownloadMetadata, 'failure_kind' | 'status'>

function classifyDownloadFailure(error: unknown): DownloadFailure {
  if (error instanceof FetchStatusError) {
    return { failure_kind: 'http', status: error.status }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { failure_kind: 'abort' }
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { failure_kind: 'timeout' }
  }
  if (error instanceof TypeError) return { failure_kind: 'network' }
  return { failure_kind: 'unknown' }
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin
  } catch {
    return false
  }
}

function downloadRoute(url: string): AssetDownloadMetadata['route'] {
  const path = url.split(/[?#]/)[0] ?? ''
  if (/\/assets\/[^/]+\/content\/?$/.test(path)) return 'assets_content'
  if (/\/view\/?$/.test(path)) return 'view'
  return 'other'
}

function mediaKindOf(
  filename: string | null | undefined
): AssetDownloadMetadata['media_kind'] {
  const mediaType = getMediaTypeFromFilename(filename)
  return mediaType === '3D' ? '3d' : mediaType
}

/**
 * Fetches `url` and saves its body as a file. `fetch` receives a callback to
 * report which credential the request carried; when omitted, the bare global
 * fetch rides the session cookie on same-origin URLs only.
 */
export async function downloadFileAsBlob(
  url: string,
  {
    filename,
    fetch: fetchFile,
    preferResponseFilename = true,
    surface = 'unknown'
  }: {
    filename?: string
    fetch?: (
      url: string,
      onAuthCredential: (credential: AuthCredential) => void
    ) => Promise<Response>
    preferResponseFilename?: boolean
    surface?: string
  } = {}
): Promise<void> {
  const knownFilename = filename || extractFilenameFromUrl(url)
  const fallbackFilename = knownFilename || DEFAULT_DOWNLOAD_FILENAME
  const startedAt = performance.now()
  let authCredential: AssetDownloadMetadata['auth_credential'] = fetchFile
    ? 'unreported'
    : isSameOrigin(url)
      ? 'session-cookie'
      : 'none'

  function report(
    outcome: Pick<
      AssetDownloadMetadata,
      'outcome' | 'failure_kind' | 'status' | 'phase' | 'size_bytes'
    >,
    reportedFilename: string | null
  ) {
    const now = performance.now()
    useTelemetry()?.trackAssetDownload({
      ...outcome,
      auth_credential: authCredential,
      route: downloadRoute(url),
      media_kind: mediaKindOf(reportedFilename),
      surface,
      duration_ms: Math.round(now - startedAt),
      page_age_ms: Math.round(now),
      online: navigator.onLine
    })
  }

  let response: Response
  try {
    response = await fetchAsBlob(
      url,
      fetchFile &&
        ((route) =>
          fetchFile(route, (credential) => (authCredential = credential)))
    )
  } catch (error) {
    report(
      {
        outcome: 'failed',
        phase: 'headers',
        ...classifyDownloadFailure(error)
      },
      knownFilename
    )
    throw error
  }

  // Try to get filename from Content-Disposition header (set by backend)
  const contentDisposition = response.headers.get('Content-Disposition')
  const headerFilename =
    extractFilenameFromContentDisposition(contentDisposition)

  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    report(
      { outcome: 'failed', phase: 'body', failure_kind: 'body_read' },
      headerFilename ?? knownFilename
    )
    throw error
  }
  report(
    { outcome: 'completed', phase: 'body', size_bytes: blob.size },
    headerFilename ?? knownFilename
  )
  downloadBlob(
    preferResponseFilename
      ? (headerFilename ?? fallbackFilename)
      : fallbackFilename,
    blob
  )
}

/**
 * Open a file URL in a new browser tab.
 * On cloud, fetches the resource as a blob first to avoid GCS redirects
 * that would trigger an auto-download instead of displaying the file.
 *
 * Opens the tab synchronously to preserve the user-gesture context
 * (browsers block window.open after an await), then navigates it to
 * the blob URL once the fetch completes.
 */
const RENDERABLE_MEDIA_TYPES = new Set([
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/ogg',
  'video/webm'
])

function isRenderableMediaType(blobType: string): boolean {
  return RENDERABLE_MEDIA_TYPES.has(blobType.split(';')[0].trim().toLowerCase())
}

export async function openFileInNewTab(url: string): Promise<void> {
  if (!isCloud) {
    window.open(url, '_blank')
    return
  }

  // Open immediately to preserve user-gesture activation.
  const tab = window.open('', '_blank')

  try {
    const response = await fetchAsBlob(url)
    const fetched = await response.blob()
    const blob = isRenderableMediaType(fetched.type)
      ? fetched
      : new Blob([fetched], { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)

    if (tab && !tab.closed) {
      tab.location.href = blobUrl
      // Revoke after the tab has had time to load the blob.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } else {
      URL.revokeObjectURL(blobUrl)
    }
  } catch (error) {
    tab?.close()
    console.error('Failed to open image:', error)
    useToast().warning(
      t('toastMessages.errorOpenImage', {
        error: getErrorMessage(error) ?? t('g.unknownError')
      })
    )
  }
}
