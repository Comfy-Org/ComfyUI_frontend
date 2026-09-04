import { default as DOMPurify } from 'dompurify'
import { Renderer, marked } from 'marked'

const ALLOWED_TAGS = ['video', 'source']
const ALLOWED_ATTRS = [
  'controls',
  'autoplay',
  'loop',
  'muted',
  'preload',
  'poster'
]

// Matches relative src attributes in img, source, and video HTML tags
// Captures: 1) opening tag with src=", 2) relative path, 3) closing quote
// Excludes absolute paths (starting with /) and URLs (http:// or https://)
// Scope: raw-HTML media gets RELATIVE rebasing only. Absolute URLs in raw
// HTML (comfy.org api forms included) pass through verbatim to sanitizing -
// the api rewrite applies to markdown-authored images and links alone.
const MEDIA_SRC_REGEX =
  /(<(?:img|source|video)[^>]*\ssrc=['"])(?!(?:[/#?]|[a-z][a-z0-9+.-]*:))([^'"\s>]+)(['"])/gi

// Rooted paths, fragments, queries, and anything carrying a scheme (http,
// javascript, data, ...) must keep their original form for sanitizing.
const NON_REBASEABLE_HREF = /^(?:[/#?]|[a-z][a-z0-9+.-]*:)/i

/**
 * Quote-only escaping for a URL in a double-quoted attribute position: the
 * quote is the only character that can terminate the attribute, and encoding
 * ampersands would double-encode a URL that already carries entities.
 */
function escapeAttributeUrl(value: string): string {
  return value.replaceAll('"', '&quot;')
}

const COMFY_ORG_HOST = /(?:^|\.)comfy\.org$/

export function resolveMarkdownUrl(href: string, baseUrl: string): string {
  if (!baseUrl) return href
  // Trailing slashes normalize HERE so a bare root base ('/') still
  // resolves relative hrefs ('' + '/view' = '/view') instead of being
  // collapsed to the no-base passthrough by a caller-side normalize.
  const base = baseUrl.replace(/\/+$/, '')
  if (!NON_REBASEABLE_HREF.test(href)) return `${base}/${href}`

  try {
    // Protocol-relative hrefs carry no scheme and fail to parse bare; read
    // them as https so a comfy.org api form still gets the rewrite.
    const url = new URL(href.startsWith('//') ? `https:${href}` : href)
    if (COMFY_ORG_HOST.test(url.hostname) && url.pathname.startsWith('/api/')) {
      return `${base}${url.pathname.slice(4)}${url.search}${url.hash}`
    }
  } catch {
    return href
  }

  return href
}

// Create a marked Renderer that prefixes relative URLs with base
function createMarkdownRenderer(baseUrl?: string): Renderer {
  const normalizedBase = baseUrl ?? ''
  const renderer = new Renderer()
  // Every interpolated attribute gets QUOTE-ONLY escaping: only the quote
  // can break out of a double-quoted attribute, and full entity encoding
  // double-encodes values that already carry character references (URLs
  // with &amp;, titles like "Tips &amp; tricks") on this public extension
  // renderer.
  renderer.image = ({ href, title, text }) => {
    const src = resolveMarkdownUrl(href, normalizedBase)
    const titleAttr = title ? ` title="${escapeAttributeUrl(title)}"` : ''
    return `<img src="${escapeAttributeUrl(src)}" alt="${escapeAttributeUrl(text)}"${titleAttr} />`
  }
  renderer.link = ({ href, title, tokens, text }) => {
    // For autolinks (bare URLs), tokens may be undefined, so fall back to text
    const target = resolveMarkdownUrl(href, normalizedBase)
    const linkText =
      text === href
        ? target
        : tokens
          ? renderer.parser.parseInline(tokens)
          : text
    const titleAttr = title ? ` title="${escapeAttributeUrl(title)}"` : ''
    return `<a href="${escapeAttributeUrl(target)}" ${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`
  }
  return renderer
}

export function renderMarkdownToHtml(
  markdown: string,
  baseUrl?: string
): string {
  if (!markdown) return ''

  let html = marked.parse(markdown, {
    renderer: createMarkdownRenderer(baseUrl),
    gfm: true // Enable GitHub Flavored Markdown (including autolinks)
  }) as string

  if (baseUrl) {
    html = html.replace(
      MEDIA_SRC_REGEX,
      `$1${baseUrl.replace(/\/+$/, '')}/$2$3`
    )
  }

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ALLOWED_TAGS,
    ADD_ATTR: [...ALLOWED_ATTRS, 'target', 'rel']
  })
}
