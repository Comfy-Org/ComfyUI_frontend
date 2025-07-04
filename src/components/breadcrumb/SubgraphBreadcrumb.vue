<template>
  <div v-if="workflowStore.isSubgraphActive" class="p-2 subgraph-breadcrumb">
    <Breadcrumb
      class="bg-transparent"
      :home="home"
      :model="items"
      aria-label="Graph navigation"
      @item-click="handleItemClick"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Breadcrumb from 'primevue/breadcrumb'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import { computed } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const workflowStore = useWorkflowStore()
const navigationStore = useSubgraphNavigationStore()

const workflowName = computed(() => workflowStore.activeWorkflow?.filename)

const items = computed(() => {
  if (!navigationStore.navigationStack.length) return []

  return navigationStore.navigationStack.map<MenuItem>((subgraph) => ({
    label: subgraph.name,
    command: () => {
      const canvas = useCanvasStore().getCanvas()
      if (!canvas.graph) throw new TypeError('Canvas has no graph')

      canvas.setGraph(subgraph)
    }
  }))
})

const home = computed(() => ({
  label: workflowName.value,
  icon: 'pi pi-home',
  command: () => {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(canvas.graph.rootGraph)
  }
}))

const handleItemClick = (event: MenuItemCommandEvent) => {
  event.item.command?.(event)
}

// Escape exits from the current subgraph.
useEventListener(document, 'keydown', (event) => {
  if (event.key === 'Escape') {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(
      navigationStore.navigationStack.at(-2) ?? canvas.graph.rootGraph
    )
  }
})
</script>

<style>
.subgraph-breadcrumb {
  .p-breadcrumb-item-link,
  .p-breadcrumb-item-icon {
    @apply select-none;

    color: #d26565;
    text-shadow:
      1px 1px 0 #000,
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      0 0 0.375rem #000;
  }
}
</style>
