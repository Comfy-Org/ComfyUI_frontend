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
 * Point an agent-authored media URL at the page's own API instead of at the
 * agent's own machine.
 *
 * The local agent writes previews into chat as absolute URLs of the ComfyUI it
 * drives — `http://127.0.0.1:8188/view?filename=...`. That renders only on the
 * box running ComfyUI: opened over a LAN address, a tailnet address or a
 * reverse proxy, the loopback host is the VIEWER's own computer and every
 * image is broken. The panel is already served by a host that answers the same
 * media routes, so keep the path and query and re-home them onto it.
 *
 * The re-homed URL is built through {@link ComfyApi.apiURL} rather than from a
 * bare origin, which is load-bearing in three ways an origin cannot cover:
 *
 * - it keeps the `api_base` subpath a reverse-proxied install is served under,
 *   which `new URL('/view…', origin)` would discard — and a subpath install is
 *   the very case that motivates the re-homing;
 * - it adds the `/api` prefix, the only media route a dev server proxies
 *   (`vite.config.mts` proxies `/api`, not a bare `/view`), so a panel served
 *   from one loopback port keeps reaching a ComfyUI on another;
 * - it lets `scopeMediaRoute` name the workspace on a web session, which an
 *   `<img>` cannot send as a header.
 *
 * Because the target comes from the API helper, it does not depend on
 * `pageOrigin`: every caller re-homes to the same place whatever base it holds,
 * so the inline `<img>` and the reply-asset preview for one URL cannot diverge.
 *
 * Only loopback hosts on ComfyUI's media routes are touched: a genuinely
 * remote ComfyUI, a relative URL (already the page's own origin) and any
 * non-media link are returned unchanged, and an already re-homed URL no longer
 * names a loopback host, so re-applying this is a no-op. That leaves the cloud
 * panel alone in practice — a cloud reply has no loopback ComfyUI to link to —
 * without branching on the distribution, so the in-app agent ComfyUI serves
 * gets the same treatment as the local harness.
 */
export function resolveAgentAssetUrl(
  href: string,
  pageOrigin = window.location.origin
): string {
  let url: URL
  try {
    // A scheme-relative reference (`//localhost:8188/view?…`) is absolute in
    // everything but its scheme, which it takes from the page. A path-relative
    // one throws here and is returned unchanged: it is already the page's own.
    url = new URL(
      href.startsWith('//') ? `${new URL(pageOrigin).protocol}${href}` : href
    )
  } catch {
    return href
  }
  if (!isLoopbackHost(url.hostname)) return href
  if (!isMediaRoute(`${url.pathname}${url.search}`)) return href
  try {
    const rehomed = new URL(
      api.apiURL(`${url.pathname}${url.search}`),
      pageOrigin
    )
    // Carried across separately rather than handed to apiURL: scopeMediaRoute
    // appends its `workspace_id` to the end of the route it is given, which
    // would land after a fragment instead of in the query.
    rehomed.hash = url.hash
    return rehomed.href
  } catch {
    return href
  }
}

const SRCSET_SPACE = /[\t\n\f\r ]/

interface SrcsetCandidate {
  url: string
  descriptor: string
}

/**
 * Split a `srcset` into candidates the way the HTML parser does (WHATWG
 * "parse a srcset attribute"), not on every comma: a URL runs until
 * whitespace, so a comma inside it stays part of it; a URL that ends in a
 * comma closes a descriptor-less candidate; otherwise the descriptors run
 * until a comma outside parentheses. Leading whitespace and stray commas
 * between candidates are skipped rather than read as an empty URL.
 */
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

/** Whitespace and stray commas between candidates. */
function skipSrcsetSeparators(value: string, position: number): number {
  while (
    position < value.length &&
    (isSrcsetSpace(value[position]) || value[position] === ',')
  )
    position++
  return position
}

/** A candidate URL runs until whitespace, commas included. */
function readSrcsetUrl(value: string, position: number): [string, number] {
  const start = position
  while (position < value.length && !isSrcsetSpace(value[position])) position++
  return [value.slice(start, position), position]
}

/** Descriptors run until a comma outside parentheses, which they consume. */
function readSrcsetDescriptor(
  value: string,
  position: number
): [string, number] {
  const start = position
  let depth = 0
  for (; position < value.length; position++) {
    const c = value[position]
    if (c === ',' && depth === 0) break
    if (c === '(') depth++
    else if (c === ')' && depth > 0) depth--
  }
  return [value.slice(start, position).trim(), position + 1]
}

/**
 * Resolve every candidate of a `srcset`, keeping each one's descriptor, or
 * null when no candidate changed.
 *
 * Null rather than the re-joined original because re-emitting is not
 * lossless: a srcset that needed no rewrite but spells its separators
 * differently (`a.png 1x,b.png 2x`, a trailing comma, doubled spaces) would
 * compare unequal and force a whole-document re-serialization, and one that is
 * nothing but whitespace and commas would become `srcset=""`.
 */
function resolveSrcset(value: string): string | null {
  const resolved: string[] = []
  let changed = false
  for (const { url, descriptor } of srcsetCandidates(value)) {
    const target = resolveAgentAssetUrl(url)
    if (target !== url) changed = true
    resolved.push(descriptor ? `${target} ${descriptor}` : target)
  }
  return changed ? resolved.join(', ') : null
}

const REWRITABLE_ATTRS = ['src', 'href', 'poster', 'srcset'] as const

/**
 * A prefilter, not a classifier. `MarkdownStream`'s segments recompute on
 * every streamed delta, so prose that cannot carry a loopback reference must
 * not pay for a parse and a re-serialization per token. It only has to never
 * miss a spelling {@link isLoopbackHost} accepts; a false positive merely
 * costs the parse it was trying to avoid.
 */
const MAYBE_LOOPBACK = /localhost|127\.|0\.0\.0\.0|::|0:0:/i

/**
 * Apply {@link resolveAgentAssetUrl} to the media references of already
 * rendered and sanitized markdown, so the `<img>` the reader sees carries the
 * reachable URL rather than only the lightbox that opens on clicking it.
 *
 * Markdown image syntax only ever yields a `src`, but raw HTML in a reply
 * survives both sanitizing passes, so `srcset` — which the browser may pick
 * over `src` — is resolved too.
 */
export function rewriteAgentAssetHtml(html: string): string {
  if (!MAYBE_LOOPBACK.test(html)) return html
  // Parsed into a <template>, whose contents the parser leaves where they were
  // written. Parsing a whole document and returning `body.innerHTML` instead
  // would silently drop whatever the parser hoists into <head> — <style> and
  // <title> both survive the sanitizing in renderMarkdownToHtml — as well as
  // orphaned table markup, so one reply would render differently depending on
  // whether it happened to carry a loopback asset at all.
  const template = document.createElement('template')
  template.innerHTML = html
  let rewritten = false
  for (const element of template.content.querySelectorAll(
    '[src], [href], [poster], [srcset]'
  )) {
    for (const name of REWRITABLE_ATTRS) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const resolved =
        name === 'srcset' ? resolveSrcset(value) : resolveAgentAssetUrl(value)
      if (resolved === null || resolved === value) continue
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
  return { url: resolveAgentAssetUrl(href, baseUrl), filename, kind }
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
