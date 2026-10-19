import type { Token } from 'marked'

import { isMediaRoute } from '@/platform/auth/session/sessionMediaUrl'
import { api } from '@/scripts/api'
import { isLoopbackHost } from '@/utils/hostWhitelist'
import type { AugmentedResultItem } from '@/utils/resultItem'
import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type ReplyAssetKind = Extract<MediaType, 'image' | 'video' | 'audio' | '3D'>

export interface ReplyAsset {
  url: string
  filename: string
  kind: ReplyAssetKind
  label?: string
}

export function isReplyAssetKind(value: MediaType): value is ReplyAssetKind {
  return (
    value === 'image' ||
    value === 'video' ||
    value === 'audio' ||
    value === '3D'
  )
}

/**
 * Moves a loopback ComfyUI media URL onto the page's API route and returns any
 * other URL unchanged.
 */
export function resolveAgentAssetUrl(href: string): string {
  const url =
    URL.parse(href) ??
    (href.startsWith('//') ? URL.parse(href, window.location.origin) : null)
  if (!url) return href
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return href
  if (!isLoopbackHost(url.hostname)) return href
  if (!isMediaRoute(`${url.pathname}${url.search}`)) return href
  const rehomed = URL.parse(
    api.apiURL(`${url.pathname}${url.search}`),
    window.location.origin
  )
  if (!rehomed) return href
  rehomed.hash = url.hash
  return rehomed.href
}

const SRCSET_SPACE = /[\t\n\f\r ]/

interface SrcsetCandidate {
  url: string
  descriptor: string
}

function srcsetCandidates(value: string): SrcsetCandidate[] {
  const candidates: SrcsetCandidate[] = []
  let position = skipSrcsetSeparators(value, 0)
  while (position < value.length) {
    const [rawUrl, afterUrl] = readSrcsetUrl(value, position)
    const closesCandidate = rawUrl.endsWith(',')
    const [descriptor, next] = closesCandidate
      ? ['', afterUrl]
      : readSrcsetDescriptor(value, afterUrl)
    const url = closesCandidate ? rawUrl.replace(/,+$/, '') : rawUrl
    if (url) candidates.push({ url, descriptor })
    position = skipSrcsetSeparators(value, next)
  }
  return candidates
}

function isSrcsetSpace(c: string): boolean {
  return SRCSET_SPACE.test(c)
}

function skipSrcsetSeparators(value: string, position: number): number {
  while (
    position < value.length &&
    (isSrcsetSpace(value[position]) || value[position] === ',')
  )
    position++
  return position
}

function readSrcsetUrl(value: string, position: number): [string, number] {
  const start = position
  while (position < value.length && !isSrcsetSpace(value[position])) position++
  return [value.slice(start, position), position]
}

function readSrcsetDescriptor(
  value: string,
  position: number
): [string, number] {
  const start = position
  let inParens = false
  for (; position < value.length; position++) {
    const c = value[position]
    if (c === ',' && !inParens) break
    if (c === '(') inParens = true
    else if (c === ')') inParens = false
  }
  return [value.slice(start, position).trim(), position + 1]
}

function resolveSrcset(value: string): string {
  const candidates = srcsetCandidates(value).map((candidate) => ({
    ...candidate,
    target: resolveAgentAssetUrl(candidate.url)
  }))
  if (candidates.every(({ url, target }) => target === url)) return value
  return candidates
    .map(({ target, descriptor }) =>
      descriptor ? `${target} ${descriptor}` : target
    )
    .join(', ')
}

const REWRITABLE_ATTRS = ['src', 'href', 'poster', 'srcset'] as const

const MAYBE_MEDIA_ROUTE = /[/\\](?:view|vhs[/\\]|assets[/\\])/

export function rewriteAgentAssetHtml(html: string): string {
  if (!MAYBE_MEDIA_ROUTE.test(html)) return html
  const template = document.createElement('template')
  template.innerHTML = html
  let rewritten = false
  for (const element of template.content.querySelectorAll(
    REWRITABLE_ATTRS.map((name) => `[${name}]`).join(', ')
  )) {
    for (const name of REWRITABLE_ATTRS) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const resolved =
        name === 'srcset' ? resolveSrcset(value) : resolveAgentAssetUrl(value)
      if (resolved === value) continue
      element.setAttribute(name, resolved)
      rewritten = true
    }
  }
  return rewritten ? template.innerHTML : html
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
  if (!isReplyAssetKind(kind)) return null
  return { url: resolveAgentAssetUrl(href), filename, kind }
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
    mediaTypeIsResolved: true,
    url: asset.url
  }
}
