<template>
  <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
    <div class="flex items-center justify-between relative">
      <span>{{ label }}</span>
      <slot name="label-action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>
