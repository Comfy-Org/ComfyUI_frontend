<script setup lang="ts">
import type { Component } from 'vue'

const { icon, label } = defineProps<{ icon: Component; label: string }>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="flex size-7 shrink-0 items-center justify-center rounded-full text-primary-warm-gray transition hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
  >
    <component :is="icon" class="size-3.5" aria-hidden="true" />
  </button>
</template>
