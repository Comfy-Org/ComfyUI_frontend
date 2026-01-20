<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
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
        'flex items-center gap-1 rounded px-2 py-1 break-all',
        'bg-node-component-surface',
        props.isDraggable &&
          'draggable-item drag-handle cursor-grab ring-accent-background hover:ring-1 [&.is-draggable]:cursor-grabbing',
        props.class
      )
    "
  >
    <div class="pointer-events-none flex-1">
      <div class="line-clamp-1 text-xs text-text-secondary">
        {{ nodeTitle }}
      </div>
      <div class="line-clamp-1 text-sm leading-8">
        {{ widgetName }}
      </div>
    </div>
    <Button
      variant="muted-textonly"
      size="sm"
      :disabled="isPhysical"
      @click.stop="$emit('toggleVisibility')"
    >
      <i :class="getIcon()" />
    </Button>
    <div
      v-if="isDraggable"
      class="pointer-events-none icon-[lucide--grip-vertical] size-4"
    />
  </div>
</template>
