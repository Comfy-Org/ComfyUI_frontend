<template>
  <Button
    :severity="isDisabled ? 'secondary' : 'success'"
    text
    icon="pi pi-play"
    :disabled="isDisabled"
    @mouseenter="() => handleMouseEnter()"
    @mouseleave="() => handleMouseLeave()"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { useUiStore } from '@/stores/uiStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const uiStore = useUiStore()
const canvasStore = useCanvasStore()
const queueSettingsStore = useQueueSettingsStore()

const canvas = canvasStore.getCanvas()
const selectedOutputNodes = computed(() =>
  canvasStore.selectedItems.filter(
    (item) => isLGraphNode(item) && item.constructor.nodeData.output_node
  )
)

const isDisabled = computed(() => selectedOutputNodes.value.length === 0)

const handleMouseEnter = () => {
  uiStore.selectionToolboxExecuteButtonHovered = true
  canvas.setDirty(true)
}

const handleMouseLeave = () => {
  uiStore.selectionToolboxExecuteButtonHovered = false
  canvas.setDirty(true)
}

const handleClick = async () => {
  const batchCount = queueSettingsStore.batchCount
  const queueNodeIds = selectedOutputNodes.value.map((node) => node.id)
  await app.queuePrompt(0, batchCount, queueNodeIds)
}
</script>
