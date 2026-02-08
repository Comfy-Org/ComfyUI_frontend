<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedNode"
      class="pointer-events-none fixed z-[10000] flex items-center gap-2 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium text-neutral-400 shadow-lg"
      :style="{
        left: `${cursorPosition.x + 12}px`,
        top: `${cursorPosition.y + 12}px`
      }"
    >
      <span class="size-3 shrink-0 rounded-full bg-neutral-500" />
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
