<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

// Click INSERTS the prompt into the composer (never sends) per the locked Figma decision.
// Figma B5: each row is a light leading-icon + label, not a filled card.
const { text, icon } = defineProps<{ text: string; icon: string }>()
const emit = defineEmits<{ insert: [text: string] }>()
</script>

<template>
  <button
    type="button"
    class="rounded-agent bg-agent-surface-raised text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    @click="emit('insert', text)"
  >
    <span
      :class="cn('text-agent-fg-subtle size-4 shrink-0', icon)"
      aria-hidden="true"
    />
    <span>{{ text }}</span>
  </button>
</template>
