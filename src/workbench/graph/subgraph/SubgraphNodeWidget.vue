<script setup lang="ts">
import Button from 'primevue/button'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  nodeTitle: string
  widgetName: string
  isShown?: boolean
  isDraggable?: boolean
  isPhysical?: boolean
}>()
defineEmits<{
  (e: 'toggleVisibility'): void
}>()

function classes() {
  return cn(
    'flex py-1 pr-4 pl-0 break-all rounded items-center gap-1',
    'bg-node-component-surface',
    props.isDraggable &&
      'draggable-item drag-handle cursor-grab [&.is-draggable]:cursor-grabbing'
  )
}
function getIcon() {
  return props.isPhysical
    ? 'icon-[lucide--link]'
    : props.isDraggable
      ? 'icon-[lucide--eye]'
      : 'icon-[lucide--eye-off]'
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
    <div class="pointer-events-none flex-1">
      <div class="text-[10px] text-slate-100">{{ nodeTitle }}</div>
      <div class="text-xs">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      text
      :icon="getIcon()"
      :disabled="isPhysical"
      severity="secondary"
      @click.stop="$emit('toggleVisibility')"
    />
  </div>
</template>
