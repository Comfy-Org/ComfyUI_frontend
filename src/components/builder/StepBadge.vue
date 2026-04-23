<template>
  <div
    class="flex size-layout-cell shrink-0 items-center justify-center rounded-lg border border-cobalt-800 bg-primary-background text-white"
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
