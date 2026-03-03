<template>
  <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
    <span class="select-none">{{ label }}</span>

    <slot>
      <span class="break-all text-muted-foreground">{{ value }}</span>
    </slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value?: string
}>()

defineSlots<{
  default: () => unknown
}>()
</script>
