<script setup lang="ts">
const { label } = defineProps<{ label: string }>()
</script>

<template>
  <div
    role="toolbar"
    :aria-label="label"
    class="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-3xl border border-transparency-white-t20 bg-primary-comfy-ink-light p-1 shadow-xl shadow-black/40 sm:flex-nowrap sm:rounded-full"
  >
    <slot />
  </div>
</template>
