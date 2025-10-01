<template>
  <div
    class="inline-flex justify-center items-center gap-1 shrink-0 py-1 px-2 text-xs bg-black/20 rounded font-bold text-white/90"
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
