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

const FILE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/></svg>`

const CODE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Create a marked Renderer that prefixes relative URLs with base
export function createMarkdownRenderer(baseUrl?: string): Renderer {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const renderer = new Renderer()

  renderer.code = ({ text, lang: rawLang }) => {
    const info = rawLang ?? ''
    const colonIdx = info.indexOf(':')
    const lang = colonIdx >= 0 ? info.slice(0, colonIdx) : info
    const filename = colonIdx >= 0 ? info.slice(colonIdx + 1) : ''
    const langLabel = lang || 'plaintext'

    const icon = filename ? FILE_ICON : CODE_ICON
    const label = filename
      ? `<span class="agent-code-block-filename">${filename}</span>`
      : `<span>${langLabel}</span>`

    return `<div class="agent-code-block"><div class="agent-code-block-header"><div class="agent-code-block-label">${icon}${label}</div><button class="agent-code-block-copy" type="button">Copy</button></div><pre><code>${escapeHtml(text)}</code></pre></div>`
  }

  renderer.codespan = ({ text }) =>
    `<code class="agent-inline-code">${text}</code>`

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
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${href}" ${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`
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
