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
const MEDIA_SRC_REGEX =
  /(<(?:img|source|video)[^>]*\ssrc=['"])(?!(?:\/|https?:\/\/))([^'"\s>]+)(['"])/gi

// Create a marked Renderer that prefixes relative URLs with base
export function createMarkdownRenderer(baseUrl?: string): Renderer {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const renderer = new Renderer()
  renderer.image = ({ href, title, text }) => {
    let src = href
    if (normalizedBase && !/^(?:\/|https?:\/\/)/.test(href)) {
      src = `${normalizedBase}/${href}`
    }
    const titleAttr = title ? ` title="${title}"` : ''
    return `<img src="${src}" alt="${text}"${titleAttr} />`
  }
  renderer.link = ({ href, title, tokens, text }) => {
    // For autolinks (bare URLs), tokens may be undefined, so fall back to text
    const linkText = tokens ? renderer.parser.parseInline(tokens) : text
    let target = href
    // Only rebase scheme-less relative paths; anything with a scheme (http,
    // javascript, data, ...) must keep its original form for sanitizing.
    if (normalizedBase && !/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(href)) {
      target = `${normalizedBase}/${href}`
    }
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${target}" ${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`
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
    html = html.replace(MEDIA_SRC_REGEX, `$1${baseUrl}$2$3`)
  }

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ALLOWED_TAGS,
    ADD_ATTR: [...ALLOWED_ATTRS, 'target', 'rel']
  })
}
