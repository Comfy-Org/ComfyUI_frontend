<template>
  <div
    class="inline-flex justify-center items-center gap-1 flex-shrink-0 py-1 px-2 text-xs bg-[#D9D9D966]/40 rounded font-bold text-white/90"
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
