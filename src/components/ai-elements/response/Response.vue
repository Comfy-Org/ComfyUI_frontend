<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { computed, useSlots } from 'vue'

import MarkdownRenderer from './MarkdownRenderer.vue'

const { content, class: className } = defineProps<{
  content?: string
  class?: HTMLAttributes['class']
}>()

const slots = useSlots()

const markdown = computed(() => {
  if (content !== undefined) return content
  const nodes = slots.default?.() ?? []
  return nodes
    .map((node) => (typeof node.children === 'string' ? node.children : ''))
    .join('')
})
</script>

<template>
  <MarkdownRenderer
    :content="markdown"
    :class="cn('text-xs/relaxed', className)"
  />
</template>
