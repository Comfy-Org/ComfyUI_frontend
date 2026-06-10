<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedNode && previewPosition"
      class="pointer-events-none fixed z-10000"
      :style="{
        left: `${previewPosition.x + 12}px`,
        top: `${previewPosition.y + 12}px`
      }"
    >
      <div class="origin-top-left scale-50 opacity-80">
        <LGraphNodePreview
          :node-def="draggedNode"
          :widget-values="pendingWidgetValues"
          position="relative"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'

const { isDragging, draggedNode, previewPosition, pendingWidgetValues } =
  useNodeDragToCanvas()
</script>
