<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { ClassValue } from '@comfyorg/tailwind-utils'

const {
  nodeTitle,
  widgetName,
  isDraggable = false,
  isPhysical = false,
  isShown = false,
  class: className
} = defineProps<{
  nodeTitle: string
  widgetName: string
  isDraggable?: boolean
  isPhysical?: boolean
  isShown?: boolean
  class?: ClassValue
}>()
defineEmits<{ toggleVisibility: [] }>()

const icon = computed(() =>
  isPhysical
    ? 'icon-[lucide--link]'
    : isShown
      ? 'icon-[lucide--eye]'
      : 'icon-[lucide--eye-off]'
)
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center gap-1 rounded-sm px-2 py-1 break-all',
        'bg-node-component-surface',
        isDraggable && 'ring-accent-background hover:ring-1',
        className
      )
    "
    data-testid="subgraph-widget-item"
  >
    <div class="pointer-events-none flex-1">
      <div
        class="line-clamp-1 text-xs text-text-secondary"
        data-testid="subgraph-widget-node-name"
      >
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
      <i :class="icon" :data-testid="isPhysical ? 'icon-link' : 'icon-eye'" />
    </Button>
    <div
      v-if="isDraggable"
      data-testid="subgraph-widget-drag-handle"
      class="pointer-events-none icon-[lucide--grip-vertical] size-4"
    />
  </div>
</template>
