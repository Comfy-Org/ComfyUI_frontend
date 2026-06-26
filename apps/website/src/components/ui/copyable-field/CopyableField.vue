<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

// Interactive: the copy button is inert until its host island is hydrated.
// Render under a `client:*` directive (e.g. `client:visible`) when the page
// needs it to work.
const { value } = defineProps<{ value: string }>()

const { copy, copied } = useClipboard({ copiedDuring: 2000 })
</script>

<template>
  <div
    class="bg-transparency-white-t4 border-primary-warm-gray flex items-center gap-2 rounded-xl border px-4 py-3"
  >
    <span class="flex-1 truncate font-mono text-xs text-primary-comfy-canvas">
      {{ value }}
    </span>
    <button
      type="button"
      :aria-label="copied ? 'Copied' : 'Copy'"
      class="text-primary-warm-gray shrink-0 cursor-pointer transition-colors hover:text-primary-comfy-canvas"
      @click="copy(value)"
    >
      <component :is="copied ? Check : Copy" class="size-4" />
    </button>
  </div>
</template>
