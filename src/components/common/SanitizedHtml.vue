<script lang="ts">
import { default as DOMPurify } from 'dompurify'
import { computed, defineComponent, h } from 'vue'

export default defineComponent({
  name: 'SanitizedHtml',
  inheritAttrs: false,
  props: {
    html: { type: String, required: true },
    as: { type: String, default: 'div' }
  },
  setup(props, { attrs }) {
    const sanitizedHtml = computed(() => {
      const fragment = DOMPurify.sanitize(props.html, {
        ADD_ATTR: ['target', 'rel'],
        RETURN_DOM_FRAGMENT: true
      })

      for (const anchor of fragment.querySelectorAll('a[target="_blank"]')) {
        const rel = new Set((anchor.getAttribute('rel') ?? '').split(/\s+/))
        rel.delete('')
        rel.add('noopener')
        rel.add('noreferrer')
        anchor.setAttribute('rel', [...rel].join(' '))
      }

      const container = document.createElement('div')
      container.append(fragment)
      return container.innerHTML
    })

    return () => h(props.as, { ...attrs, innerHTML: sanitizedHtml.value })
  }
})
</script>
