import { marked } from 'marked'
import { html, parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { defineComponent, h } from 'vue'
import type { VNodeChild } from 'vue'

// Match SafeRichTextContent's parse5-to-VNode boundary, with the block tags
// needed by release Markdown. Never assign remote markup through innerHTML.
const allowed = new Set([
  'p',
  'strong',
  'em',
  'a',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'br',
  'h2',
  'h3',
  'h4',
  'blockquote'
])
const blocked = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'svg',
  'math'
])

function nodes(node: DefaultTreeAdapterTypes.ChildNode): VNodeChild[] {
  if ('value' in node) return [node.value]
  if (!('tagName' in node)) return []
  if (node.namespaceURI !== html.NS.HTML || blocked.has(node.tagName)) return []
  const children = node.childNodes.flatMap(nodes)
  if (!allowed.has(node.tagName)) return children
  const attrs: Record<string, string> = {}
  if (node.tagName === 'a') {
    const href = node.attrs.find((attr) => attr.name === 'href')?.value.trim()
    if (href && /^https:\/\//i.test(href)) {
      try {
        const url = new URL(href)
        if (url.protocol === 'https:' && !url.username && !url.password)
          attrs.href = url.href
      } catch {
        /* Invalid source links render as plain text. */
      }
    }
  }
  return [h(node.tagName, attrs, children)]
}

export default defineComponent({
  name: 'ChangelogMarkdown',
  props: { markdown: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        'div',
        parseFragment(
          marked.parse(props.markdown, { async: false })
        ).childNodes.flatMap(nodes)
      )
  }
})
