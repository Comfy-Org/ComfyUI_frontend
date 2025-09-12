<template>
  <Button
    v-show="hasOutputNodesSelected && !isDisabled"
    v-tooltip.top="{
      value: t('selectionToolbox.executeButton.tooltip'),
      showDelay: 1000
    }"
    class="dark-theme:bg-[#0B8CE9] bg-[#31B9F4] size-8 !p-0"
    text
    :disabled="isDisabled"
    @mouseenter="() => handleMouseEnter()"
    @mouseleave="() => handleMouseLeave()"
    @click="handleClick"
  >
    <i-lucide:play class="fill-path-white w-4 h-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { isOutputNode } from '@/utils/nodeFilterUtil'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const { hasOutputNodesSelected, selectedNodes } = useSelectionState()

const canvas = canvasStore.getCanvas()
const buttonHovered = ref(false)
const selectedOutputNodes = computed(() =>
  selectedNodes.value.filter(isLGraphNode).filter(isOutputNode)
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
<style scoped>
:deep.fill-path-white > path {
  fill: white;
  stroke: unset;
}
</style>
