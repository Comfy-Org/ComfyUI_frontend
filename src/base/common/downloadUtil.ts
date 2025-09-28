/**
 * Utility functions for downloading files
 */

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
  const link = document.createElement('a')
  link.href = url
  link.download =
    filename || extractFilenameFromUrl(url) || DEFAULT_DOWNLOAD_FILENAME

  // Trigger download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
