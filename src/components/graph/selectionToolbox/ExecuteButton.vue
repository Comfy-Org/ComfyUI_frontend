<template>
  <Button
    v-tooltip.top="{
      value: isDisabled
        ? t('selectionToolbox.executeButton.disabledTooltip')
        : t('selectionToolbox.executeButton.tooltip'),
      showDelay: 1000
    }"
    :severity="isDisabled ? 'secondary' : 'success'"
    text
    :disabled="isDisabled"
    @mouseenter="() => handleMouseEnter()"
    @mouseleave="() => handleMouseLeave()"
    @click="handleClick"
  >
    <i-lucide:play />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useUiStore } from '@/stores/uiStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const uiStore = useUiStore()
const canvasStore = useCanvasStore()
const commandStore = useCommandStore()

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
  await commandStore.execute('Comfy.QueueSelectedOutputNodes')
}
</script>
