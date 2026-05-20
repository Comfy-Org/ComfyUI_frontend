import { api } from '@/scripts/api'

import type { AssetItem } from '../schemas/assetSchema'
import { getAssetUrl } from './assetUrlUtil'

type RenditionSurface = 'grid' | 'lightbox' | 'newTab' | 'download'

// Rendition URLs from the assets API are typically root-relative (e.g.
// `/assets/{id}/content`). Browser-absolute (http/https), blob, and data
// URLs are returned by some adapters (LoadImage widget, cloud previews)
// and must pass through untouched. Anything else goes via `api.apiURL()`
// so it gets the base prefix and `/api` route the server expects.
function normalizeRenditionUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?:|blob:|data:)/i.test(url)) return url
  if (url.startsWith('/')) return api.apiURL(url)
  return url
}

// Image MIME types that every supported browser can render via `<img>`.
// Format policy lives here, not in callers. Keep this list narrow and
// authoritative — if a MIME isn't on it, the asset gets icon-fallback
// treatment regardless of file extension.
const RENDERABLE_IMAGE_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
])

const RENDERABLE_VIDEO_MIME_TYPES = new Set<string>([
  'video/mp4',
  'video/webm',
  'video/ogg'
])

const RENDERABLE_AUDIO_MIME_TYPES = new Set<string>([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-flac'
])

export function canRenderNatively(
  mimeType: string | null | undefined
): boolean {
  if (!mimeType) return false
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  return (
    RENDERABLE_IMAGE_MIME_TYPES.has(normalized) ||
    RENDERABLE_VIDEO_MIME_TYPES.has(normalized) ||
    RENDERABLE_AUDIO_MIME_TYPES.has(normalized)
  )
}

interface AssetRenditionFields {
  mime_type?: string | null
  preview_url?: string
  thumbnail_url?: string
}

// Resolves which URL the UI should use for a given display surface, applying
// these rules (which align with the planned /assets API contract):
//
//   grid / hover / sidebar:   thumbnail_url ?? preview_url ?? (renderable ? canonical : null)
//   lightbox / new tab:       preview_url ?? (renderable ? canonical : null)
//   download / open / copy:   canonical (the original asset, never a transcoded substitute)
//
// Returning null means "no usable URL for this surface" — callers render an
// icon placeholder. The asset itself is never special-cased by extension;
// renderability is decided purely from `mime_type` via canRenderNatively().
export function renditionFor(
  asset: AssetItem,
  surface: RenditionSurface
): string | null {
  const fields: AssetRenditionFields = asset
  const canonical = getAssetUrl(asset)
  const renderable = canRenderNatively(fields.mime_type)

  switch (surface) {
    case 'grid':
      return (
        normalizeRenditionUrl(fields.thumbnail_url) ||
        normalizeRenditionUrl(fields.preview_url) ||
        (renderable ? canonical : null)
      )
    case 'lightbox':
    case 'newTab':
      return (
        normalizeRenditionUrl(fields.preview_url) ||
        (renderable ? canonical : null)
      )
    case 'download':
      return canonical
  }
}
