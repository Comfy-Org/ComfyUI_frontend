<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

// Interactive: inert until its host island hydrates, so render it under a
// `client:*` directive. Each instance keeps its own copied state, which is why
// this is a component rather than one `useClipboard` shared across a list.
const { value, label, copiedLabel } = defineProps<{
  value: string
  label: string
  copiedLabel: string
}>()

const { copy, copied } = useClipboard({ copiedDuring: 2000 })
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
          : 'hover:text-primary-comfy-yellow text-primary-warm-gray'
      )
    "
    @click="void copy(value)"
  >
    <component :is="copied ? Check : Copy" class="size-5" />
    <span v-if="copied" class="text-sm whitespace-nowrap">
      {{ copiedLabel }}
    </span>
    <span class="sr-only" aria-live="polite">
      {{ copied ? copiedLabel : '' }}
    </span>
  </button>
</template>
