<template>
  <Button
    v-if="isUnpackVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_UnpackSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="() => commandStore.execute('Comfy.Graph.UnpackSubgraph')"
  >
    <template #icon>
      <i-lucide:expand />
    </template>
  </Button>
  <Button
    v-else-if="isConvertVisible"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LGraphGroup, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isUnpackVisible = computed(() => {
  return (
    canvasStore.selectedItems?.length === 1 &&
    canvasStore.selectedItems[0] instanceof SubgraphNode
  )
})

const isConvertVisible = computed(() => {
  const items = canvasStore.selectedItems
  if (!items || items.length === 0) {
    return false
  }

  // Unpack button takes precedence for single subgraph node
  if (items.length === 1 && items[0] instanceof SubgraphNode) {
    return false
  }

  // Hide if ALL selected items are groups
  const allAreGroups = items.every((item) => item instanceof LGraphGroup)
  if (allAreGroups) {
    return false
  }

  // Otherwise, show it, assuming there's some selection
  return (
    canvasStore.groupSelected ||
    canvasStore.rerouteSelected ||
    canvasStore.nodeSelected
  )
})
</script>
