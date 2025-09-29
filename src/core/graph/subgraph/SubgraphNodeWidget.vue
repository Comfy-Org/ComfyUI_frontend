<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  nodeTitle: string
  widgetName: string
  isShown?: boolean
  isDraggable?: boolean
}>()
defineEmits<{
  (e: 'toggleVisibility'): void
}>()
</script>
<template>
  <div
    class="flex pt-1 pr-4 pb-1 pl-0 break-all rounded bg-[var(--p-dialog-background,#202020)] items-center gap-1"
  >
    <div class="size-4">
      <i-lucide:grip-vertical v-if="isDraggable" />
    </div>
    <div class="flex-1">
      <div class="text-slate-100 text-[10px]">{{ nodeTitle }}</div>
      <div class="text-xs">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      class="shrink-0"
      text
      severity="secondary"
      @click.stop="$emit('toggleVisibility')"
    >
      <i-lucide:eye v-if="isShown" />
      <i-lucide:eye-off v-else />
    </Button>
  </div>
</template>
