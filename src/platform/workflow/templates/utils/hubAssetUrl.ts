const HUB_ASSETS_ORIGIN = 'https://comfy-hub-assets.comfy.org'
const HUB_ASSETS_DEV_PREFIX = '/__hub_assets'
const CF_MEDIA_PATH_PREFIX = '/cdn-cgi/media'
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'] as const

type VideoExtension = (typeof VIDEO_EXTENSIONS)[number]

function getUrlExtension(url: string): string | undefined {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url
    return pathname.split('.').pop()?.toLowerCase() || undefined
  } catch {
    return undefined
  }
}

export function rewriteHubAssetUrl(url?: string): string | undefined {
  if (!url || !import.meta.env.DEV) return url
  return url.startsWith(HUB_ASSETS_ORIGIN)
    ? `${HUB_ASSETS_DEV_PREFIX}${url.slice(HUB_ASSETS_ORIGIN.length)}`
    : url
}

export function isVideoSrc(url?: string): boolean {
  const extension = url ? getUrlExtension(url) : undefined
  return (
    !!extension &&
    (VIDEO_EXTENSIONS as readonly string[]).includes(
      extension as VideoExtension
    )
  )
}

export function getVideoFrameUrl(url: string, time = '1s'): string {
  const segment = `${CF_MEDIA_PATH_PREFIX}/mode=frame,time=${time}`

  if (url.startsWith(HUB_ASSETS_ORIGIN)) {
    return `${HUB_ASSETS_ORIGIN}${segment}${url.slice(HUB_ASSETS_ORIGIN.length)}`
  }

  if (url.startsWith(HUB_ASSETS_DEV_PREFIX)) {
    return `${HUB_ASSETS_DEV_PREFIX}${segment}${url.slice(HUB_ASSETS_DEV_PREFIX.length)}`
  }

  return url
}
