import { default as DOMPurify } from 'dompurify'
import { escape } from 'es-toolkit'
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
const COMFY_ORG_HOST = /(?:^|\.)comfy\.org$/

export function resolveMarkdownUrl(href: string, baseUrl: string): string {
  if (!baseUrl) return href
  if (!NON_REBASEABLE_HREF.test(href)) return `${baseUrl}/${href}`

  try {
    // Protocol-relative hrefs carry no scheme and fail to parse bare; read
    // them as https so a comfy.org api form still gets the rewrite.
    const url = new URL(href.startsWith('//') ? `https:${href}` : href)
    if (COMFY_ORG_HOST.test(url.hostname) && url.pathname.startsWith('/api/')) {
      return `${baseUrl}${url.pathname.slice(4)}${url.search}${url.hash}`
    }
  } catch {
    return href
  }

  return href
}

// Create a marked Renderer that prefixes relative URLs with base
function createMarkdownRenderer(baseUrl?: string): Renderer {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const renderer = new Renderer()
  // Resolved targets and author-supplied titles interpolate into attribute
  // positions before sanitizing; escaping there keeps a quote in either from
  // breaking out of the attribute at parse time.
  renderer.image = ({ href, title, text }) => {
    const src = resolveMarkdownUrl(href, normalizedBase)
    const titleAttr = title ? ` title="${escape(title)}"` : ''
    return `<img src="${escape(src)}" alt="${escape(text)}"${titleAttr} />`
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
    const titleAttr = title ? ` title="${escape(title)}"` : ''
    return `<a href="${escape(target)}" ${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`
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
