<template>
  <div class="flex items-center gap-2 p-2 2xl:px-4">
    <div class="min-w-0 flex-1">
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
  <div v-if="bottomDivider" class="border-t border-dashed border-comfy-input" />
</template>

<script setup lang="ts">
defineProps<{
  bottomDivider?: boolean
}>()
</script>
