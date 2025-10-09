<template>
  <div
    class="inline-flex shrink-0 items-center justify-center gap-1 rounded bg-[#D9D9D966]/40 px-2 py-1 text-xs font-bold text-white/90"
  >
    <slot name="icon" class="text-xs text-white/90"></slot>
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
const { label } = defineProps<{
  label: string
}>()
</script>
