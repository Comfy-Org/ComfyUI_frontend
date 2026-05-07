<template>
  <div
    class="flex size-layout-cell shrink-0 items-center justify-center rounded-lg border border-(--border-color) bg-layout-cell-hover text-layout-text"
  >
    <span class="text-layout-xl font-bold">
      {{ index + 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  index: number
}>()
</script>
