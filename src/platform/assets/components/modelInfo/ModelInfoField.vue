<template>
  <div class="flex flex-col gap-1 px-4 py-2">
    <span class="text-xs text-muted-foreground">{{ label }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>
