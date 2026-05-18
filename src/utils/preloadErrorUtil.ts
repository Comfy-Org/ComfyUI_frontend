type PreloadFileType = 'js' | 'css' | 'font' | 'image' | 'unknown'

interface PreloadErrorInfo {
  url: string | null
  fileType: PreloadFileType
  chunkName: string | null
  message: string
}

const CSS_PRELOAD_RE = /Unable to preload CSS for (.+)/
const JS_DYNAMIC_IMPORT_RE =
  /Failed to fetch dynamically imported module:\s*(.+)/
const URL_FALLBACK_RE = /https?:\/\/[^\s"')]+/

const FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot'])
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
  'ico'
])

function extractUrl(message: string): string | null {
  const cssMatch = message.match(CSS_PRELOAD_RE)
  if (cssMatch) return cssMatch[1].trim()

  const jsMatch = message.match(JS_DYNAMIC_IMPORT_RE)
  if (jsMatch) return jsMatch[1].trim()

  const fallbackMatch = message.match(URL_FALLBACK_RE)
  if (fallbackMatch) return fallbackMatch[0]

  return null
}

function detectFileType(url: string): PreloadFileType {
  const pathname = new URL(url, 'https://cloud.comfy.org').pathname
  const ext = pathname.split('.').pop()?.toLowerCase()
  if (!ext) return 'unknown'

  // Strip query params from extension
  const cleanExt = ext.split('?')[0]

  if (cleanExt === 'js' || cleanExt === 'mjs') return 'js'
  if (cleanExt === 'css') return 'css'
  if (FONT_EXTENSIONS.has(cleanExt)) return 'font'
  if (IMAGE_EXTENSIONS.has(cleanExt)) return 'image'
  return 'unknown'
}

function extractChunkName(url: string): string | null {
  const pathname = new URL(url, 'https://cloud.comfy.org').pathname
  const filename = pathname.split('/').pop()
  if (!filename) return null

  // Strip extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  // Strip hash suffix (e.g. "vendor-vue-core-abc123" -> "vendor-vue-core")
  const withoutHash = nameWithoutExt.replace(/-[a-f0-9]{6,}$/, '')
  return withoutHash || null
}

export function parsePreloadError(error: Error): PreloadErrorInfo {
  const message = error.message || String(error)
  const url = extractUrl(message)

  return {
    url,
    fileType: url ? detectFileType(url) : 'unknown',
    chunkName: url ? extractChunkName(url) : null,
    message
  }
}
