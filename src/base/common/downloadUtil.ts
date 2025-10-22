/**
 * Utility functions for downloading files
 */
import { isCloud } from '@/platform/distribution/types'

// Constants
const DEFAULT_DOWNLOAD_FILENAME = 'download.png'

/**
 * Download a file from a URL by creating a temporary anchor element
 * @param url - The URL of the file to download (must be a valid URL string)
 * @param filename - Optional filename override (will use URL filename or default if not provided)
 * @throws {Error} If the URL is invalid or empty
 */
export const downloadFile = (url: string, filename?: string): void => {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Invalid URL provided for download')
  }

  const inferredFilename =
    filename || extractFilenameFromUrl(url) || DEFAULT_DOWNLOAD_FILENAME

  if (isCloud) {
    // Assets from cross-origin (e.g., GCS) cannot be downloaded this way
    void downloadViaBlobFetch(url, inferredFilename).catch((error) => {
      console.error('Failed to download file', error)
    })
    return
  }

  const link = document.createElement('a')
  link.href = url
  link.download = inferredFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Download a Blob by creating a temporary object URL and anchor element
 * @param filename - The filename to suggest to the browser
 * @param blob - The Blob to download
 */
export const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  // Trigger download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

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

const downloadViaBlobFetch = async (
  href: string,
  filename: string
): Promise<void> => {
  const response = await fetch(href)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${href}: ${response.status}`)
  }
  const blob = await response.blob()
  downloadBlob(filename, blob)
}
