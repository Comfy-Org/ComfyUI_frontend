import { html, parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'

const ALLOWED_TAGS = new Set(['a', 'br', 'code', 'li', 'ol', 'span', 'strong'])
const BLOCKED_TAGS = new Set([
  'embed',
  'iframe',
  'math',
  'object',
  'script',
  'style',
  'svg',
  'template'
])
const ALLOWED_CLASSES = new Set([
  'text-primary-comfy-yellow',
  'text-white',
  'underline',
  'whitespace-nowrap'
])
const HREF_BASE = new URL('https://comfy.org')

export type SafeRichTextNode =
  | { type: 'text'; value: string }
  | {
      type: 'element'
      tag: string
      attrs: Record<string, string>
      children: SafeRichTextNode[]
    }

function sanitizeHref(value: string): string | undefined {
  const href = value.trim()
  if (/[^\S ]/.test(href)) return

  try {
    const url = new URL(href, HREF_BASE)
    if (url.protocol === 'mailto:' && /^mailto:/i.test(href)) return href
    if (/^https:\/\//i.test(href)) return href
    if (href.startsWith('/') && url.origin === HREF_BASE.origin) return href
  } catch {
    return undefined
  }
  return undefined
}

function sanitizeClass(value: string): string | undefined {
  const classes = value
    .split(/\s+/)
    .filter((className) => ALLOWED_CLASSES.has(className))
  return classes.length ? classes.join(' ') : undefined
}

function sanitizeAttrs(
  element: DefaultTreeAdapterTypes.Element
): Record<string, string> {
  const attrs = new Map(element.attrs.map(({ name, value }) => [name, value]))
  const sanitized: Record<string, string> = {}

  if (element.tagName === 'a') {
    const href = sanitizeHref(attrs.get('href') ?? '')
    if (href) {
      sanitized.href = href
      if (attrs.get('target') === '_blank') {
        sanitized.target = '_blank'
        sanitized.rel = 'noopener noreferrer'
      }
    }
  }

  if (element.tagName === 'a' || element.tagName === 'span') {
    const className = sanitizeClass(attrs.get('class') ?? '')
    if (className) sanitized.class = className
  }

  return sanitized
}

function convertNode(
  node: DefaultTreeAdapterTypes.ChildNode
): SafeRichTextNode[] {
  if ('value' in node) return [{ type: 'text', value: node.value }]
  if (!('tagName' in node)) return []
  if (node.namespaceURI !== html.NS.HTML || BLOCKED_TAGS.has(node.tagName)) {
    return []
  }

  const children = node.childNodes.flatMap(convertNode)
  if (!ALLOWED_TAGS.has(node.tagName)) return children

  return [
    {
      type: 'element',
      tag: node.tagName,
      attrs: sanitizeAttrs(node),
      children
    }
  ]
}

export function parseSafeRichText(htmlFragment: string): SafeRichTextNode[] {
  return parseFragment(htmlFragment).childNodes.flatMap(convertNode)
}
