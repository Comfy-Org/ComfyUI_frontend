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

const { html, as = 'div' } = defineProps<{
  html: string
  as?: 'div' | 'span'
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
    ]
  })
)
</script>
