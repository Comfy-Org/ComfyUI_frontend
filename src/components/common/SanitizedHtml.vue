<script lang="ts">
import { default as createDOMPurify } from 'dompurify'
import { computed, defineComponent, h } from 'vue'

// Isolated instance: the shared singleton is mutated at import time by
// litegraph's ContextMenu, so the posture here would otherwise depend on
// module import order.
const purifier = createDOMPurify(window)

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'samp',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var'
]

export default defineComponent({
  name: 'SanitizedHtml',
  inheritAttrs: false,
  props: {
    html: { type: String, required: true },
    as: { type: String, default: 'div' }
  },
  setup(props, { attrs }) {
    const sanitizedHtml = computed(() => {
      const fragment = purifier.sanitize(props.html, {
        ALLOWED_TAGS,
        ADD_ATTR: ['target', 'rel'],
        FORBID_ATTR: ['style'],
        RETURN_DOM_FRAGMENT: true
      })

      for (const element of fragment.querySelectorAll('[target]')) {
        const rel = new Set((element.getAttribute('rel') ?? '').split(/\s+/))
        rel.delete('')
        rel.add('noopener')
        rel.add('noreferrer')
        element.setAttribute('rel', [...rel].join(' '))
      }

      const container = document.createElement('div')
      container.append(fragment)
      return container.innerHTML
    })

    return () => h(props.as, { ...attrs, innerHTML: sanitizedHtml.value })
  }
})
</script>
