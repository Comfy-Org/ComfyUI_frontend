import { html, parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'

const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'a',
  'br',
  'code',
  'li',
  'ol',
  'span',
  'strong'
])
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

export type SafeRichTextNode =
  | { type: 'text'; value: string }
  | {
      type: 'element'
      tag: string
      attrs: Record<string, string>
      children: SafeRichTextNode[]
    }

function isAllowedHref(value: string): boolean {
  const href = value.toLowerCase()
  return (
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    (href.startsWith('/') && !href.startsWith('//'))
  )
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
    const href = attrs.get('href')?.trim()
    if (href && isAllowedHref(href)) {
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
  if ('value' in node) {
    return [{ type: 'text', value: node.value }]
  }
  if (!('tagName' in node)) return []
  if (BLOCKED_TAGS.has(node.tagName)) return []

  const children = node.childNodes.flatMap(convertNode)
  if (node.namespaceURI !== html.NS.HTML || !ALLOWED_TAGS.has(node.tagName)) {
    return children
  }

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
