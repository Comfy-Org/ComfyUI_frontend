<script setup lang="ts">
import Button from 'primevue/button'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  nodeTitle: string
  widgetName: string
  isShown?: boolean
  isDraggable?: boolean
}>()
defineEmits<{
  (e: 'toggleVisibility'): void
}>()

function classes() {
  return cn(
    'flex py-1 pr-4 pl-0 break-all rounded items-center gap-1',
    'bg-pure-white dark-theme:bg-charcoal-800',
    props.isDraggable
      ? 'drag-handle draggable-item cursor-grab [.is-draggable]:cursor-grabbing'
      : ''
  )
}
</script>
<template>
  <div :class="classes()">
    <div
      :class="
        cn(
          'size-4 pointer-events-none',
          isDraggable ? 'icon-[lucide--grip-vertical]' : ''
        )
      "
    />
    <div class="flex-1 pointer-events-none">
      <div class="text-slate-100 text-[10px]">{{ nodeTitle }}</div>
      <div class="text-xs">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      text
      :icon="isDraggable ? 'icon-[lucide--eye]' : 'icon-[lucide--eye-off]'"
      severity="secondary"
      @click.stop="$emit('toggleVisibility')"
    />
  </div>
</template>
