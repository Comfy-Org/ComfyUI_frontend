<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

defineProps<{ href: string; label: string }>()
</script>

<template>
  <a
    :href
    class="group inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
  >
    {{ label }}
    <ChevronRight
      class="size-4 transition-transform group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </a>
</template>
