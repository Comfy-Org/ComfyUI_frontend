import { html } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { h } from 'vue'
import type { VNodeChild } from 'vue'

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
const UNSAFE_URL_CHARACTERS = /[\s\p{Cc}]/u

export function hasUnsafeUrlCharacters(href: string) {
  return UNSAFE_URL_CHARACTERS.test(href)
}

export function safeHttpsUrl(value: string): URL | undefined {
  const href = value.trim()
  if (hasUnsafeUrlCharacters(href) || !/^https:\/\//i.test(href)) return
  try {
    const url = new URL(href)
    return url.username || url.password ? undefined : url
  } catch {
    return undefined
  }
}

interface SafeMarkupPolicy {
  allowedTags: ReadonlySet<string>
  attrs: (
    element: DefaultTreeAdapterTypes.Element
  ) => Record<string, string> | null
}

export function toSafeVNodes(
  node: DefaultTreeAdapterTypes.ChildNode,
  policy: SafeMarkupPolicy
): VNodeChild[] {
  if ('value' in node) return [node.value]
  if (!('tagName' in node)) return []
  if (node.namespaceURI !== html.NS.HTML || BLOCKED_TAGS.has(node.tagName)) {
    return []
  }

  const children = node.childNodes.flatMap((child) =>
    toSafeVNodes(child, policy)
  )
  if (!policy.allowedTags.has(node.tagName)) return children

  const attrs = policy.attrs(node)
  return attrs ? [h(node.tagName, attrs, children)] : children
}
