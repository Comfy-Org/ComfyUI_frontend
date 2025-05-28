<template>
  <Button
    v-show="canvasStore.nodeSelected"
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
import type { LGraphNode } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const canvasStore = useCanvasStore()
const commandStore = useCommandStore()

const canvas = canvasStore.getCanvas()
const buttonHovered = ref(false)
const selectedOutputNodes = computed(
  () =>
    canvasStore.selectedItems.filter(
      (item) => isLGraphNode(item) && item.constructor.nodeData?.output_node
    ) as LGraphNode[]
)

const isDisabled = computed(() => selectedOutputNodes.value.length === 0)

function outputNodeStokeStyle(this: LGraphNode) {
  if (
    this.selected &&
    this.constructor.nodeData?.output_node &&
    buttonHovered.value
  ) {
    return { color: 'orange', lineWidth: 2, padding: 10 }
  }
}

const handleMouseEnter = () => {
  buttonHovered.value = true
  for (const node of selectedOutputNodes.value) {
    node.strokeStyles['outputNode'] = outputNodeStokeStyle
  }
  canvas.setDirty(true)
}

const handleMouseLeave = () => {
  buttonHovered.value = false
  canvas.setDirty(true)
}

const handleClick = async () => {
  await commandStore.execute('Comfy.QueueSelectedOutputNodes')
}
</script>
