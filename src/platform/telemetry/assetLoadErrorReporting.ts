import { parsePreloadError } from '@/utils/preloadErrorUtil'

import { reportError } from './reportError'

/**
 * Asset failures reach a sink only on cloud builds, and `reportError` writes
 * the console line there. Every other distribution logs locally instead, so
 * one failure never produces two console lines or two RUM events.
 */
export function reportResourceLoadError(url: string, tagName: string): void {
  if (__DISTRIBUTION__ !== 'cloud') {
    console.error('[resource:loadError]', { url, tagName })
    return
  }

  reportError(new Error(`Resource load failed: ${url}`), {
    errorType: 'resource_load_error',
    tags: { tag_name: tagName }
  })
}

export function reportPreloadError(error: Error): void {
  const info = parsePreloadError(error)

  if (__DISTRIBUTION__ !== 'cloud') {
    console.error('[vite:preloadError]', {
      url: info.url,
      fileType: info.fileType,
      chunkName: info.chunkName,
      message: info.message
    })
    return
  }

  reportError(error, {
    errorType: 'vite_preload_error',
    tags: {
      file_type: info.fileType,
      chunk_name: info.chunkName ?? undefined
    },
    context: {
      url: info.url,
      fileType: info.fileType,
      chunkName: info.chunkName
    }
  })
}
