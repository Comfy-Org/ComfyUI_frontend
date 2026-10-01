<script setup lang="ts">
import { MousePointer2 } from '@lucide/vue'

const { text } = defineProps<{ text: string }>()
</script>

<template>
  <p
    class="pointer-events-none absolute top-3.5 left-1/2 flex h-6.5 -translate-x-1/2 items-center gap-1.5 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-2.5 text-[11px] whitespace-nowrap text-primary-warm-gray max-sm:hidden"
  >
    <MousePointer2 class="size-3" aria-hidden="true" />
    {{ text }}
  </p>
</template>
