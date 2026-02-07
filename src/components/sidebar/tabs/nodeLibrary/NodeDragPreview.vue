<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedNode"
      class="pointer-events-none fixed z-[10000] rounded-md bg-comfy-menu-bg px-3 py-2 text-sm font-medium text-foreground shadow-lg border border-border-default"
      :style="{
        left: `${cursorPosition.x + 12}px`,
        top: `${cursorPosition.y + 12}px`
      }"
    >
      {{ draggedNode.display_name }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'

const { isDragging, draggedNode, cursorPosition, setupGlobalListeners } =
  useNodeDragToCanvas()

onMounted(() => {
  setupGlobalListeners()
})
</script>
