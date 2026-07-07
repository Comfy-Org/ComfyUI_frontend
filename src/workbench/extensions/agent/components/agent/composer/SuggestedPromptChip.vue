<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

// Click INSERTS the prompt into the composer (never sends) per the locked Figma decision.
// Per the design reference: a rounded-full pill (leading icon + label) that stacks
// full-width in narrow panels and wraps centered from 460px container width up.
const { text, icon } = defineProps<{ text: string; icon: string }>()
const emit = defineEmits<{ insert: [text: string] }>()
</script>

<template>
  <button
    type="button"
    class="bg-agent-surface-raised text-agent-fg hover:bg-agent-surface-hover focus-visible:ring-agent-accent flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-full px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none @min-[460px]:w-auto"
    @click="emit('insert', text)"
  >
    <span
      :class="cn('text-agent-fg-muted size-3 shrink-0', icon)"
      aria-hidden="true"
    />
    <span class="truncate">{{ text }}</span>
  </button>
</template>
