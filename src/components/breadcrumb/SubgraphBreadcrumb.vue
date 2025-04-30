<template>
  <div
    v-if="subgraphStore.isSubgraphActive"
    class="fixed top-[var(--comfy-topbar-height)] left-[var(--sidebar-width)] p-2 subgraph-breadcrumb"
  >
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
import { useEventListener, whenever } from '@vueuse/core'
import Breadcrumb from 'primevue/breadcrumb'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import { computed } from 'vue'

import { useWorkflowService } from '@/services/workflowService'
import { useCanvasStore } from '@/stores/graphStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const subgraphStore = useSubgraphStore()

const workflowName = computed(() => workflowStore.activeWorkflow?.filename)

const items = computed(() => {
  if (!subgraphStore.graphNamePath.length) return []

  return subgraphStore.graphNamePath.slice(1).map<MenuItem>((name) => ({
    label: name,
    command: async () => {
      const workflow = workflowStore.getWorkflowByPath(name)
      if (workflow) await workflowService.openWorkflow(workflow)
    }
  }))
})

const home = computed(() => ({
  label: workflowName.value,
  icon: 'pi pi-home',
  command: async () => {
    const canvas = useCanvasStore().getCanvas()
    if (!canvas.graph) throw new TypeError('Canvas has no graph')

    canvas.setGraph(canvas.graph.rootGraph)
  }
}))

const handleItemClick = (event: MenuItemCommandEvent) => {
  event.item.command?.(event)
}

whenever(
  () => useCanvasStore().canvas,
  (canvas) => {
    useEventListener(canvas.canvas, 'set-graph', () => {
      useSubgraphStore().updateActiveGraph()
    })
  }
)
</script>

<style>
.subgraph-breadcrumb {
  .p-breadcrumb-item-link,
  .p-breadcrumb-item-icon {
    color: #d26565;
  }
}
</style>
