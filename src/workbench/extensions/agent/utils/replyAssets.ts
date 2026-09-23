import type { Token } from 'marked'

import type { AugmentedResultItem } from '@/utils/resultItem'
import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import { isAgentStandalone } from '../agentDistribution'

type ReplyAssetKind = Extract<MediaType, 'image' | 'video' | 'audio' | '3D'>

export interface ReplyAsset {
  url: string
  filename: string
  kind: ReplyAssetKind
  label?: string
}

const ASSET_KINDS = new Set<MediaType>(['image', 'video', 'audio', '3D'])

/**
 * Hosts that can only ever mean "the computer this URL was written on".
 * `URL.hostname` keeps the brackets around an IPv6 literal, hence `[::1]`.
 */
const LOOPBACK_HOST = /^(?:localhost|0\.0\.0\.0|\[::1\]|127(?:\.\d{1,3}){3})$/i

/** ComfyUI's media routes, with and without the `/api` prefix. */
const COMFY_MEDIA_PATH = /^\/(?:api\/)?view(?:video|audio)?$/

/**
 * Point an agent-authored media URL at the panel instead of at the agent's own
 * machine.
 *
 * The local agent writes previews into chat as absolute URLs of the ComfyUI it
 * drives — `http://127.0.0.1:8188/view?filename=...`. That renders only on the
 * box running ComfyUI: opened over a LAN address, a tailnet address or a
 * reverse proxy, the loopback host is the VIEWER's own computer and every
 * image is broken. The panel is already served by a host that answers the same
 * `/view` routes, so keep the path and query and swap in its origin.
 *
 * Only loopback hosts on ComfyUI's media routes are touched: a genuinely
 * remote ComfyUI, a relative URL (already the panel's own origin) and any
 * non-media link are returned unchanged. Cloud builds never take this path —
 * the cloud agent has no loopback ComfyUI to link to.
 */
export function resolveAgentAssetUrl(
  href: string,
  origin = window.location.origin
): string {
  if (!isAgentStandalone()) return href
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href
  }
  if (!LOOPBACK_HOST.test(url.hostname)) return href
  if (!COMFY_MEDIA_PATH.test(url.pathname)) return href
  try {
    return new URL(`${url.pathname}${url.search}${url.hash}`, origin).href
  } catch {
    return href
  }
}

/**
 * Apply {@link resolveAgentAssetUrl} to the media references of already
 * rendered and sanitized markdown, so the `<img>` the reader sees carries the
 * reachable URL rather than only the lightbox that opens on clicking it.
 */
export function rewriteAgentAssetHtml(html: string): string {
  if (!isAgentStandalone()) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let rewritten = false
  for (const element of doc.querySelectorAll('[src], [href], [poster]')) {
    for (const name of ['src', 'href', 'poster']) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const resolved = resolveAgentAssetUrl(value)
      if (resolved === value) continue
      element.setAttribute(name, resolved)
      rewritten = true
    }
  }
  return rewritten ? doc.body.innerHTML : html
}

export function classifyAssetUrl(
  href: string,
  baseUrl = window.location.origin
): ReplyAsset | null {
  let url: URL
  try {
    url = new URL(href, baseUrl)
  } catch {
    return null
  }
  let filename = url.searchParams.get('filename')
  try {
    filename ??= decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
  } catch {
    return null
  }
  if (!filename) return null
  const kind = getMediaTypeFromFilename(filename)
  if (!ASSET_KINDS.has(kind)) return null
  return {
    url: resolveAgentAssetUrl(href, baseUrl),
    filename,
    kind: kind as ReplyAssetKind
  }
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

// A lone image LINK keeps FE-1328's link contract; image syntax, non-image
// singles, and any multiple become the DES-530 asset treatment.
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

export function replyAssetResultItem(asset: ReplyAsset): AugmentedResultItem {
  return {
    filename: asset.filename,
    subfolder: '',
    type: 'output',
    nodeId: '',
    mediaType: asset.kind === 'image' ? 'images' : asset.kind,
    url: asset.url
  }
}
