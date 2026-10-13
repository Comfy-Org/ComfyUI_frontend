<script setup lang="ts">
import { Undo2 } from '@lucide/vue'

/** Puts back the source just taken out of the panel; it sits in the tray. */
const { label } = defineProps<{ label: string }>()
const emit = defineEmits<{ undo: [] }>()
</script>

<template>
  <button
    type="button"
    class="pointer-events-auto flex h-9 cursor-pointer items-center gap-2 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 pr-3.5 pl-2.5 text-xs text-primary-warm-white transition hover:bg-primary-comfy-ink-light focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
    @click="emit('undo')"
  >
    <Undo2 class="size-4" aria-hidden="true" />
    {{ label }}
  </button>
</template>
