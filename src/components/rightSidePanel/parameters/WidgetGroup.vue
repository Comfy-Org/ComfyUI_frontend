<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

const { isDraggable = false } = defineProps<{
  isDraggable?: boolean
}>()
</script>

<template>
  <div
    :class="
      cn(
        'widget-group rounded-lg',
        isDraggable &&
          'draggable-item drag-handle group cursor-grab bg-comfy-menu-bg [&.is-draggable]:cursor-grabbing [&.is-draggable]:outline-4 [&.is-draggable]:outline-comfy-menu-bg [&.is-draggable]:outline-offset-0 [&.is-draggable]:opacity-70 [&_.widget-item-header]:pointer-events-none'
      )
    "
  >
    <slot />
    <!-- Drag handle indicator -->
    <div
      v-if="isDraggable"
      class="pointer-events-none mt-1.5 mx-auto max-w-40 w-1/2 h-1 rounded-lg bg-transparent transition-colors duration-150 group-hover:bg-interface-stroke group-[.is-draggable]:bg-component-node-widget-background-highlighted"
    />
  </div>
</template>
