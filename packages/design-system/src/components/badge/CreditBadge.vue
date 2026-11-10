<template>
  <span
    data-testid="credit-badge"
    class="flex h-5 shrink-0 items-center gap-1 rounded-md bg-input px-2 py-0.5 text-xs"
  >
    <i class="icon-[lucide--coins] aspect-square size-3.5 bg-credit" />
    <span class="truncate" v-text="text" />
  </span>
</template>

<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>
