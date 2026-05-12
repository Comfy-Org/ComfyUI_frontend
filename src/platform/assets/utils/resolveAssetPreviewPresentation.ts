import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

/**
 * Narrow input: only fields used for preview resolution (no dependency on full
 * {@link AssetItem}).
 * Callers may pass wider typed objects such as AssetItem.
 */
export type AssetPreviewSource = Pick<
  AssetItem,
  'name' | 'display_name' | 'mime_type' | 'thumbnail_url' | 'preview_url'
>

/** Why a tile shows a placeholder instead of a raster preview. */
type AssetPreviewPlaceholderReason = 'missing_url' | 'unsupported_type'

/**
 * Resolved preview for asset grid tiles. Phase 1: `image` (raster in {@code
 * <img>}) and `placeholder` only. Future kinds (e.g. `video`, `threeD`,
 * `audio`, `text`) can extend this union without changing {@link AssetPreviewSource}.
 */
type AssetPreviewPresentation =
  | { kind: 'image'; url: string; alt: string }
  | {
      kind: 'placeholder'
      icon: string
      alt: string
      reason?: AssetPreviewPlaceholderReason
    }

function trimUrl(url: string | null | undefined): string | undefined {
  const t = url?.trim()
  return t && t.length > 0 ? t : undefined
}

function pickRasterUrl(asset: AssetPreviewSource): string | undefined {
  return trimUrl(asset.thumbnail_url) ?? trimUrl(asset.preview_url)
}

function pickThumbnailOnly(asset: AssetPreviewSource): string | undefined {
  return trimUrl(asset.thumbnail_url)
}

/** Passed from {@link useI18n} in components; keeps this module free of Vue context. */
export type AssetPreviewPresentationTranslate = (key: string) => string

function resolveAlt(
  asset: AssetPreviewSource,
  t: AssetPreviewPresentationTranslate
): string {
  return trimUrl(asset.display_name) ?? asset.name ?? t('assets.fallbackAlt')
}

function mimeLower(asset: AssetPreviewSource): string {
  return asset.mime_type?.trim().toLowerCase() ?? ''
}

function fileKind(asset: AssetPreviewSource): MediaType {
  return getMediaTypeFromFilename(asset.name)
}

function placeholder(
  mediaKind: MediaType,
  alt: string,
  reason: AssetPreviewPlaceholderReason
): AssetPreviewPresentation {
  return {
    kind: 'placeholder',
    icon: iconForMediaType(mediaKind),
    alt,
    reason
  }
}

/**
 * Pure presentation resolver for asset grid tiles (e.g. {@link AssetCard}).
 * Prefer {@link AssetPreviewSource.mime_type}, then filename extension; prefer
 * {@link AssetPreviewSource.thumbnail_url} over {@link AssetPreviewSource.preview_url}
 * for raster URLs. Video MIME is poster-only (thumbnail) to avoid loading raw
 * video in {@code <img>}.
 *
 * @param t {@link useI18n} {@code t} from the caller for localized alt fallbacks.
 */
export function resolveAssetPreviewPresentation(
  asset: AssetPreviewSource,
  t: AssetPreviewPresentationTranslate
): AssetPreviewPresentation {
  const alt = resolveAlt(asset, t)
  const mime = mimeLower(asset)

  if (mime.startsWith('image/')) {
    const url = pickRasterUrl(asset)
    return url
      ? { kind: 'image', url, alt }
      : placeholder('image', alt, 'missing_url')
  }

  if (mime.startsWith('video/')) {
    const poster = pickThumbnailOnly(asset)
    return poster
      ? { kind: 'image', url: poster, alt }
      : placeholder('video', alt, 'missing_url')
  }

  if (mime.startsWith('audio/')) {
    return placeholder('audio', alt, 'unsupported_type')
  }

  const extKind = fileKind(asset)

  if (extKind === 'image') {
    const url = pickRasterUrl(asset)
    return url
      ? { kind: 'image', url, alt }
      : placeholder('image', alt, 'missing_url')
  }

  if (extKind === 'video') {
    const poster = pickThumbnailOnly(asset)
    return poster
      ? { kind: 'image', url: poster, alt }
      : placeholder('video', alt, 'missing_url')
  }

  if (extKind === 'audio') {
    return placeholder('audio', alt, 'unsupported_type')
  }

  if (extKind === '3D' || extKind === 'text') {
    return placeholder(extKind, alt, 'unsupported_type')
  }

  const url = pickRasterUrl(asset)
  if (url) {
    return { kind: 'image', url, alt }
  }

  return placeholder(extKind, alt, 'missing_url')
}
