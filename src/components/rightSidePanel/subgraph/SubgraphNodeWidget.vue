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
        'flex items-center gap-1 rounded-sm px-2 py-1 break-all',
        'bg-node-component-surface',
        props.isDraggable && 'ring-accent-background hover:ring-1',
        props.class
      )
    "
  >
    <div class="pointer-events-none flex-1">
      <div class="line-clamp-1 text-xs text-text-secondary">
        {{ nodeTitle }}
      </div>
      <div class="line-clamp-1 text-sm/8" data-testid="subgraph-widget-label">
        {{ widgetName }}
      </div>
    </div>
    <Button
      variant="muted-textonly"
      size="sm"
      data-testid="subgraph-widget-toggle"
      :disabled="isPhysical"
      @click.stop="$emit('toggleVisibility')"
    >
      <i
        :class="getIcon()"
        :data-testid="isPhysical ? 'icon-link' : 'icon-eye'"
      />
    </Button>
    <div
      v-if="isDraggable"
      class="pointer-events-none icon-[lucide--grip-vertical] size-4"
    />
  </div>
</template>
