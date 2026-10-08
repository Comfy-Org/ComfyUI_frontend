import { marked } from 'marked'
import { parseFragment } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { defineComponent, h } from 'vue'

import { safeHttpsUrl, toSafeVNodes } from '@/components/common/safeMarkup'

const allowedTags = new Set([
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
  'h3',
  'blockquote'
])

function attrs(
  element: DefaultTreeAdapterTypes.Element
): Record<string, string> | null {
  if (element.tagName !== 'a') return {}
  const href = element.attrs.find((attr) => attr.name === 'href')?.value
  const url = safeHttpsUrl(href ?? '')
  return url ? { href: url.href } : null
}

const policy = { allowedTags, attrs }

export default defineComponent({
  name: 'ChangelogMarkdown',
  props: { markdown: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        'div',
        parseFragment(
          marked.parse(props.markdown, { async: false })
        ).childNodes.flatMap((node) => toSafeVNodes(node, policy))
      )
  }
})
