<template>
  <div
    class="flex h-14 min-w-0 items-center pl-5 text-sm font-medium text-foreground/80"
  >
    <span class="truncate">{{ title }}</span>
  </div>
</template>

<script setup lang="ts">
const { title } = defineProps<{ title: string }>()
</script>
