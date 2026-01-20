<template>
  <div
    class="flex items-center gap-2 p-4 font-inter text-sm font-bold text-base-foreground"
  >
    <span
      v-if="title"
      class="flex-auto"
    >{{ title }}</span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>
