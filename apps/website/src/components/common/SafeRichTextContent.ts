import { parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'

import {
  hasUnsafeUrlCharacters,
  safeHttpsUrl,
  toSafeVNodes
} from './safeMarkup'

const ALLOWED_TAGS = new Set(['a', 'br', 'code', 'li', 'ol', 'span', 'strong'])
const ALLOWED_CLASSES = new Set([
  'text-primary-comfy-yellow',
  'text-white',
  'underline',
  'whitespace-nowrap'
])
const HREF_BASE = new URL('https://comfy.org')

type RichTextRootTag = 'div' | 'h2' | 'h3' | 'p' | 'span'

function sanitizeHref(value: string): string | undefined {
  const href = value.trim()
  if (safeHttpsUrl(href)) return href
  if (hasUnsafeUrlCharacters(href)) return undefined

  try {
    const url = new URL(href, HREF_BASE)
    if (url.protocol === 'mailto:' && /^mailto:/i.test(href)) return href
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

const policy = { allowedTags: ALLOWED_TAGS, attrs: sanitizeAttrs }

export default defineComponent({
  name: 'SafeRichText',
  inheritAttrs: false,
  props: {
    html: { type: String, required: true },
    as: {
      type: String as PropType<RichTextRootTag>,
      default: 'span'
    }
  },
  setup(props, { attrs }) {
    return () =>
      h(
        props.as,
        attrs,
        parseFragment(props.html).childNodes.flatMap((node) =>
          toSafeVNodes(node, policy)
        )
      )
  }
})
