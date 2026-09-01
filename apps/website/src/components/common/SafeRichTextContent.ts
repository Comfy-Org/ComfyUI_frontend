import { defineComponent, h } from 'vue'
import type { PropType, VNodeChild } from 'vue'

import { parseSafeRichText } from './safeRichText'
import type { SafeRichTextNode } from './safeRichText'

type RichTextRootTag = 'div' | 'h2' | 'h3' | 'p' | 'span'

function toVNode(node: SafeRichTextNode): VNodeChild {
  if (node.type === 'text') return node.value
  return h(node.tag, node.attrs, node.children.map(toVNode))
}

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
    return () => h(props.as, attrs, parseSafeRichText(props.html).map(toVNode))
  }
})
