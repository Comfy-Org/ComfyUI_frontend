<script setup lang="ts">
import Button from 'primevue/button'

import { cn } from '@/utils/tailwindUtil'

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
    <div
      :class="cn('size-4', isDraggable ? 'icon-[lucide--grip-vertical]' : '')"
    />
    <div class="flex-1">
      <div class="text-slate-100 text-[10px]">{{ nodeTitle }}</div>
      <div class="text-xs">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      text
      :icon="`icon-[lucide--eye${isDraggable ? '' : '-off'}]`"
      severity="secondary"
      @click.stop="$emit('toggleVisibility')"
    />
  </div>
</template>
