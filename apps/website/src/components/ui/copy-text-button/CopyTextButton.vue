<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

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
    :aria-label="copied ? copiedLabel : label"
    :title="copied ? copiedLabel : label"
    class="hover:text-primary-comfy-yellow inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-primary-warm-gray transition-colors"
    @click="void copy(value)"
  >
    <component :is="copied ? Check : Copy" class="size-5" />
  </button>
</template>
