<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import { computed } from 'vue'

const {
  value,
  variant = 'default',
  copyLabel = 'Copy',
  copiedLabel = 'Copied'
} = defineProps<{
  value: string
  variant?: 'default' | 'cli'
  copyLabel?: string
  copiedLabel?: string
}>()

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
        'flex gap-2 rounded-xl border border-primary-warm-gray bg-transparency-white-t4 px-4 py-3',
        multiline ? 'items-start' : 'items-center',
        variant === 'cli' && 'rounded-2xl p-2 pl-4'
      )
    "
  >
    <span
      :class="
        cn(
          'flex-1 font-mono text-xs text-primary-comfy-canvas',
          variant === 'cli'
            ? 'min-w-0 py-3 text-left text-2xs/relaxed wrap-anywhere whitespace-pre-wrap sm:text-xs/relaxed lg:text-sm/relaxed'
            : multiline
              ? 'wrap-break-word whitespace-pre-line'
              : 'truncate'
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
          'shrink-0 cursor-pointer text-primary-warm-gray transition-colors hover:text-primary-comfy-canvas',
          multiline && 'mt-0.5',
          variant === 'cli' &&
            'flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none'
        )
      "
      @click="handleCopy"
    >
      <component :is="copied ? Check : Copy" class="size-4" />
    </button>
    <span role="status" class="sr-only">{{ copied ? copiedLabel : '' }}</span>
  </div>
</template>
