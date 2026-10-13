<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-if="as === 'span'" v-bind="$attrs" v-html="sanitizedHtml" />
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-else v-bind="$attrs" v-html="sanitizedHtml" />
</template>

<script setup lang="ts">
import { default as createDOMPurify } from 'dompurify'
import { computed } from 'vue'

const purifier = createDOMPurify(window)

// Interactive controls let authored content impersonate a sign-in box. A GFM
// task list is the only legitimate source of <input> here, so keep the
// disabled checkbox it emits and drop every other control.
const FORBIDDEN_CONTROLS = ['form', 'button', 'textarea', 'select', 'option']

purifier.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return
  const isTaskListCheckbox =
    node instanceof Element &&
    node.getAttribute('type') === 'checkbox' &&
    node.hasAttribute('disabled')
  if (!isTaskListCheckbox) node.parentNode?.removeChild(node)
})

defineOptions({ inheritAttrs: false })

const {
  html,
  as = 'div',
  allowInlineStyle = false
} = defineProps<{
  html: string
  as?: 'div' | 'span'
  /**
   * Permits inline `style` on the sanitized markup. Only for first-party
   * generated HTML that carries its own presentation, such as syntax
   * highlighting. Leave off for authored content: an inline style is enough
   * to draw a full-screen overlay or an invisible click-hijacking link.
   */
  allowInlineStyle?: boolean
}>()

const sanitizedHtml = computed(() =>
  purifier.sanitize(html, {
    ADD_TAGS: ['video', 'source'],
    ADD_ATTR: [
      'controls',
      'autoplay',
      'loop',
      'muted',
      'preload',
      'poster',
      'target',
      'rel'
    ],
    FORBID_TAGS: FORBIDDEN_CONTROLS,
    FORBID_ATTR: allowInlineStyle ? [] : ['style']
  })
)
</script>
