<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import type { HTMLAttributes } from 'vue'

// Interactive: inert until its host island hydrates, so render it under a
// `client:*` directive. Each instance keeps its own copied state, which is why
// this is a component rather than one `useClipboard` shared across a list.
const {
  value,
  label,
  copiedLabel,
  showLabel = false,
  class: className
} = defineProps<{
  value: string
  label: string
  copiedLabel: string
  /** Render the label beside the icon. Icon-only stays the default. */
  showLabel?: boolean
  class?: HTMLAttributes['class']
}>()

const { copy, copied } = useClipboard({ copiedDuring: 2000 })
</script>

<template>
  <button
    type="button"
    :aria-label="copied ? copiedLabel : label"
    :title="copied ? copiedLabel : label"
    :class="
      cn(
        'hover:text-primary-comfy-yellow inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-primary-warm-gray transition-colors',
        className
      )
    "
    @click="void copy(value)"
  >
    <!-- Beside a label the icon tracks the caller's font-size; on its own it
         is a fixed-size hit target. -->
    <component
      :is="copied ? Check : Copy"
      :class="showLabel ? 'size-[1.2em]' : 'size-5'"
    />
    <span v-if="showLabel">{{ copied ? copiedLabel : label }}</span>
  </button>
</template>
