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

defineOptions({ inheritAttrs: false })

const {
  html,
  as = 'div',
  profile = 'default'
} = defineProps<{
  html: string
  as?: 'div' | 'span'
  profile?: 'default' | 'highlighted-code'
}>()

purifier.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName !== 'style') return
  if (profile !== 'highlighted-code' || !(node instanceof HTMLSpanElement)) {
    data.keepAttr = false
    return
  }

  const source = document.createElement('span').style
  const allowed = document.createElement('span').style
  source.cssText = data.attrValue
  for (const property of ['color', 'font-style', 'font-weight']) {
    allowed.setProperty(property, source.getPropertyValue(property))
  }
  data.attrValue = allowed.cssText
  data.keepAttr = data.attrValue.length > 0
})

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
    FORBID_TAGS: ['form', 'input', 'button'],
    FORBID_ATTR: profile === 'highlighted-code' ? [] : ['style']
  })
)
</script>
