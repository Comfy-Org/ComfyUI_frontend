<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import { computed } from 'vue'

// Interactive: the copy button is inert until its host island is hydrated.
// Render under a `client:*` directive (e.g. `client:visible`) when the page
// needs it to work.
const {
  value,
  copyLabel = 'Copy',
  copiedLabel = 'Copied'
} = defineProps<{ value: string; copyLabel?: string; copiedLabel?: string }>()

const multiline = computed(() => value.includes('\n'))

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

function handleCopy() {
  void copy(value)
}
</script>

<template>
  <div
    :class="
      cn(
        'bg-transparency-white-t4 border-primary-warm-gray flex gap-2 rounded-xl border px-4 py-3',
        multiline ? 'items-start' : 'items-center'
      )
    "
  >
    <span
      :class="
        cn(
          'flex-1 font-mono text-xs text-primary-comfy-canvas',
          multiline ? 'wrap-break-word whitespace-pre-line' : 'truncate'
        )
      "
    >
      {{ value }}
    </span>
    <button
      type="button"
      :aria-label="copied ? copiedLabel : copyLabel"
      :class="
        cn(
          'text-primary-warm-gray shrink-0 cursor-pointer transition-colors hover:text-primary-comfy-canvas',
          multiline && 'mt-0.5'
        )
      "
      @click="handleCopy"
    >
      <component :is="copied ? Check : Copy" class="size-4" />
    </button>
  </div>
</template>
