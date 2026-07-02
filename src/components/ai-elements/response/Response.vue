<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { computed, useSlots } from 'vue'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

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

const renderedHtml = computed(() => renderMarkdownToHtml(markdown.value))

function onContainerClick(event: MouseEvent) {
  const btn = (event.target as Element).closest<HTMLButtonElement>(
    '.agent-code-block-copy'
  )
  if (!btn) return
  const code = btn.closest('.agent-code-block')?.querySelector('code')
  if (!code) return
  navigator.clipboard
    .writeText(code.textContent ?? '')
    .then(() => {
      btn.textContent = 'Copied!'
      setTimeout(() => {
        btn.textContent = 'Copy'
      }, 2000)
    })
    .catch(() => {})
}
</script>

<template>
  <div
    :class="
      cn(
        'text-xs/relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )
    "
    @click="onContainerClick"
    v-html="renderedHtml"
  />
</template>
