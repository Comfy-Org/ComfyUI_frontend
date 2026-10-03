<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { Check, Copy } from '@lucide/vue'
import { useTimeoutFn } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

// Interactive: inert until its host island hydrates, so render it under a
// `client:*` directive. Each instance keeps its own copied state, which is why
// this is a component rather than one `useClipboard` shared across a list.
const {
  value,
  label,
  copiedLabel,
  class: className,
  iconClass
} = defineProps<{
  value: string
  label: string
  copiedLabel: string
  class?: HTMLAttributes['class']
  iconClass?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ copied: [] }>()
const copied = ref(false)
const { start, stop } = useTimeoutFn(() => (copied.value = false), 2000, {
  immediate: false
})

async function copy() {
  stop()
  copied.value = false
  if (!(await writeClipboard(value))) return
  copied.value = true
  start()
  emit('copied')
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    return legacyCopy(text)
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.className = 'fixed opacity-0'
  textarea.readOnly = true
  document.body.appendChild(textarea)
  try {
    textarea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :class="
      cn(
        'inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 transition-colors',
        copied
          ? 'text-primary-comfy-yellow'
          : 'text-primary-warm-gray hover:text-primary-comfy-yellow',
        className
      )
    "
    @click="copy"
  >
    <component :is="copied ? Check : Copy" :class="cn('size-5', iconClass)" />
    <span v-if="copied" class="text-sm whitespace-nowrap">
      {{ copiedLabel }}
    </span>
    <span class="sr-only" aria-live="polite">
      {{ copied ? copiedLabel : '' }}
    </span>
  </button>
</template>
