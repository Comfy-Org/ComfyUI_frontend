<template>
  <Button
    v-if="isUnpackVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_UnpackSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    data-testid="unpack-subgraph-button"
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
    data-testid="convert-to-subgraph-button"
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

import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
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
  // Don't show if no nodes/reroutes are selected (only groups, reroutes, etc.)
  if (!canvasStore.nodeSelected) return false

  // Don't show if exactly one SubgraphNode is selected (unpack button handles that)
  if (
    canvasStore.selectedItems.length === 1 &&
    canvasStore.selectedItems[0] instanceof SubgraphNode
  ) {
    return false
  }

  // Show in all other cases (including multiple SubgraphNodes)
  return true
})
</script>
