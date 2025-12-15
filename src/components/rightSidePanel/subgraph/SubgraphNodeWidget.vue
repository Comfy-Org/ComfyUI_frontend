<script setup lang="ts">
import Button from 'primevue/button'

import { cn } from '@/utils/tailwindUtil'
import type { ClassValue } from '@/utils/tailwindUtil'

const props = defineProps<{
  nodeTitle: string
  widgetName: string
  isDraggable?: boolean
  isPhysical?: boolean
  class?: ClassValue
}>()
defineEmits<{
  (e: 'toggleVisibility'): void
}>()

function getIcon() {
  return props.isPhysical
    ? 'icon-[lucide--link]'
    : props.isDraggable
      ? 'icon-[lucide--eye]'
      : 'icon-[lucide--eye-off]'
}
</script>

<template>
  <div
    :class="
      cn(
        'flex py-1 px-2 break-all rounded items-center gap-1',
        'bg-node-component-surface',
        props.isDraggable &&
          'draggable-item drag-handle cursor-grab [&.is-draggable]:cursor-grabbing hover:ring-1 ring-accent-background',
        props.class
      )
    "
  >
    <div class="pointer-events-none flex-1">
      <div class="text-xs text-text-secondary line-clamp-1">
        {{ nodeTitle }}
      </div>
      <div class="text-sm line-clamp-1 leading-8">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      text
      :icon="getIcon()"
      :disabled="isPhysical"
      severity="secondary"
      @click.stop="$emit('toggleVisibility')"
    />
    <div
      v-if="isDraggable"
      class="size-4 pointer-events-none icon-[lucide--grip-vertical]"
    />
  </div>
</template>
