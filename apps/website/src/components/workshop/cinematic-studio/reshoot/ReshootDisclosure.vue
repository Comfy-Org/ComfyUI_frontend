<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

const { label } = defineProps<{ label: string }>()
</script>

<template>
  <details class="group rounded-2xl border border-transparency-white-t8">
    <summary
      class="flex h-12 cursor-pointer list-none items-center justify-between rounded-2xl px-3 text-sm font-semibold text-primary-warm-white select-none hover:bg-transparency-white-t4 [&::-webkit-details-marker]:hidden"
    >
      {{ label }}
      <ChevronDown
        class="size-4 text-primary-warm-gray transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="px-3 pb-3">
      <slot />
    </div>
  </details>
</template>
