type PreloadFileType = 'js' | 'css' | 'font' | 'image' | 'unknown'

interface PreloadErrorInfo {
  kind: 'css_preload' | 'dynamic_import' | 'unknown'
  url: string | null
  fileType: PreloadFileType
  chunkName: string | null
  message: string
}

const CSS_PRELOAD_RE = /^Unable to preload CSS for (.+)$/
const JS_DYNAMIC_IMPORT_RE =
  /(?:Failed to fetch|error loading) dynamically imported module:\s*(.+)/i
const DYNAMIC_IMPORT_FAILURE_RE =
  /^(?:(?:Failed to fetch|error loading) dynamically imported module(?::|$)|Importing a module script failed\.?$)/i
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

function detectFileType(pathname: string): PreloadFileType {
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

function extractChunkName(pathname: string): string | null {
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
  let resource: URL | null
  try {
    resource = url ? new URL(url, 'https://cloud.comfy.org') : null
  } catch {
    resource = null
  }

  return {
    kind: CSS_PRELOAD_RE.test(message)
      ? 'css_preload'
      : DYNAMIC_IMPORT_FAILURE_RE.test(message)
        ? 'dynamic_import'
        : 'unknown',
    url,
    fileType: resource ? detectFileType(resource.pathname) : 'unknown',
    chunkName: resource ? extractChunkName(resource.pathname) : null,
    message
  }
}
