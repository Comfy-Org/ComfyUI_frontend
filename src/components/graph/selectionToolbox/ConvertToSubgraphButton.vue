<template>
  <Button
    v-show="isVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_ConvertToSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="() => commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
  >
    <template #icon>
      <i-lucide:shrink />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  LGraphGroup,
  LGraphNode,
  Positionable
} from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isVisible = () => {
  const selectableItems = canvasStore.selectedItems ?? []

  // Only show if at least one item is selected that is not a SubgraphNode
  // and not a group.
  const isNotGroupOrSubgraphNode = (item: Positionable) =>
    !(
      item instanceof LGraphGroup ||
      (item instanceof LGraphNode && item.isSubgraphNode?.())
    )

  return Array.from(selectableItems).some(isNotGroupOrSubgraphNode)
}

watch(isVisible, (newVal) => {
  console.log('isVisible', newVal)
})
</script>
