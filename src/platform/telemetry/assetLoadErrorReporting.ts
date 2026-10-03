import { parsePreloadError } from '@/utils/preloadErrorUtil'

import { reportError } from './reportError'

function isFirstPartyResource(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return true
  }
}

export function reportResourceLoadError(url: string, tagName: string): void {
  let isAuthSdk: boolean
  try {
    const resource = new URL(url, window.location.href)
    isAuthSdk =
      tagName === 'script' &&
      resource.origin === 'https://apis.google.com' &&
      resource.pathname === '/js/api.js'
    if (isAuthSdk) url = `${resource.origin}${resource.pathname}`
  } catch {
    isAuthSdk = false
  }

  if (!isAuthSdk && !isFirstPartyResource(url)) return

  if (__DISTRIBUTION__ !== 'cloud') {
    console.error('[resource:loadError]', { url, tagName })
    return
  }

  reportError(new Error(`Resource load failed: ${url}`), {
    surface: isAuthSdk ? 'auth' : 'platform',
    errorType: isAuthSdk ? 'error_loading_auth_sdk' : 'resource_load_error',
    tags: { tag_name: tagName },
    ...(isAuthSdk ? { context: { url } } : {})
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
    surface: 'platform',
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
