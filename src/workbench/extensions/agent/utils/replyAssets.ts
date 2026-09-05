import type { Token } from 'marked'

import { ResultItemImpl } from '@/stores/queueStore'
import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type ReplyAssetKind = Extract<MediaType, 'image' | 'video' | 'audio' | '3D'>

export interface ReplyAsset {
  url: string
  filename: string
  kind: ReplyAssetKind
  label?: string
}

const ASSET_KINDS = new Set<MediaType>(['image', 'video', 'audio', '3D'])

export function classifyAssetUrl(href: string): ReplyAsset | null {
  let url: URL
  try {
    url = new URL(href, window.location.origin)
  } catch {
    return null
  }
  const filename =
    url.searchParams.get('filename') ??
    decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
  if (!filename) return null
  const kind = getMediaTypeFromFilename(filename)
  if (!ASSET_KINDS.has(kind)) return null
  return { url: href, filename, kind: kind as ReplyAssetKind }
}

type InlineToken = { type: string; href?: string; text?: string }

interface InlineScan {
  assets: ReplyAsset[]
  sawImageSyntax: boolean
}

function scanInline(tokens: InlineToken[] | undefined): InlineScan | null {
  const scan: InlineScan = { assets: [], sawImageSyntax: false }
  for (const token of tokens ?? []) {
    if (token.type === 'image' || token.type === 'link') {
      const asset = token.href ? classifyAssetUrl(token.href) : null
      if (!asset) return null
      if (token.type === 'image') {
        scan.sawImageSyntax = true
        if (token.text) asset.label = token.text
      }
      scan.assets.push(asset)
    } else if (token.type === 'br' || token.type === 'space') {
      continue
    } else if (token.type === 'text' && (token.text ?? '').trim() === '') {
      continue
    } else {
      return null
    }
  }
  return scan.assets.length ? scan : null
}

// A lone image link stays inline; image syntax, non-image singles, and any
// multiple use the asset-grid treatment.
function selectAssets(scan: InlineScan): ReplyAsset[] | null {
  const { assets, sawImageSyntax } = scan
  if (assets.length > 1 || sawImageSyntax) return assets
  return assets[0].kind === 'image' ? null : assets
}

/* A block is an asset block only when every inline token is a media link. */
export function tokenReplyAssets(token: Token): ReplyAsset[] | null {
  if (token.type === 'paragraph') {
    const scan = scanInline(token.tokens)
    return scan ? selectAssets(scan) : null
  }
  if (token.type !== 'list') return null

  const combined: InlineScan = { assets: [], sawImageSyntax: false }
  for (const item of token.items) {
    for (const block of item.tokens as InlineToken[]) {
      if (block.type !== 'text' && block.type !== 'paragraph') return null
      const scan = scanInline((block as { tokens?: InlineToken[] }).tokens)
      if (!scan) return null
      combined.assets.push(...scan.assets)
      combined.sawImageSyntax ||= scan.sawImageSyntax
    }
  }
  return combined.assets.length ? selectAssets(combined) : null
}

export function htmlReplyAssets(html: string): ReplyAsset[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Set<string>()
  const out: ReplyAsset[] = []
  for (const element of doc.querySelectorAll('a[href], img[src]')) {
    const href =
      element.getAttribute('href') ?? element.getAttribute('src') ?? ''
    const asset = classifyAssetUrl(href)
    if (asset && !seen.has(asset.url)) {
      seen.add(asset.url)
      out.push(asset)
    }
  }
  return out
}

export function replyAssetResultItem(asset: ReplyAsset): ResultItemImpl {
  const item = new ResultItemImpl({
    filename: asset.filename,
    subfolder: '',
    type: 'output',
    nodeId: '',
    mediaType: asset.kind === 'image' ? 'images' : asset.kind
  })
  Object.defineProperty(item, 'url', { get: () => asset.url })
  return item
}
