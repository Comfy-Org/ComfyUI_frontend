<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useMutationObserver } from '@vueuse/core'
import type { HTMLAttributes } from 'vue'
import { provide, ref, useTemplateRef } from 'vue'

import { conversationKey } from './context'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const scrollEl = useTemplateRef<HTMLDivElement>('scrollEl')
const isAtBottom = ref(true)

function updateAtBottom() {
  const el = scrollEl.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24
}

function scrollToBottom() {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

useMutationObserver(
  scrollEl,
  () => {
    if (isAtBottom.value) {
      requestAnimationFrame(scrollToBottom)
    }
  },
  { childList: true, subtree: true, characterData: true }
)

provide(conversationKey, { isAtBottom, scrollToBottom })
</script>

<template>
  <div
    ref="scrollEl"
    :class="cn('relative flex-1 overflow-y-auto', className)"
    @scroll="updateAtBottom"
  >
    <slot />
  </div>
</template>
