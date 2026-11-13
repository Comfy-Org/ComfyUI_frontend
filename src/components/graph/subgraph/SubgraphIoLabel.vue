<script setup lang="ts">
const { label, status } = defineProps<{ label: string; status?: string }>()
</script>

<template>
  <div
    class="mx-3 flex h-(--node-widget-height) min-w-0 items-center gap-2 rounded-(--node-widget-radius) bg-input/50 px-3"
  >
    <span class="truncate">{{ label }}</span>
    <span v-if="status" class="ml-auto truncate text-muted-foreground italic">{{
      status
    }}</span>
  </div>
</template>
