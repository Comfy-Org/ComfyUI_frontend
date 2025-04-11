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
import Breadcrumb from 'primevue/breadcrumb'
import { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import { computed } from 'vue'

import { useWorkflowService } from '@/services/workflowService'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const subgraphStore = useSubgraphStore()

const items = computed(() => {
  if (!subgraphStore.graphNamePath.length) return []

  return subgraphStore.graphNamePath.map<MenuItem>((name, index) => ({
    label: name,
    icon:
      index === subgraphStore.graphNamePath.length - 1
        ? 'pi pi-home'
        : undefined,
    command: async () => {
      const workflow = workflowStore.getWorkflowByPath(name)
      if (workflow) await workflowService.openWorkflow(workflow)
    }
  }))
})

const home = computed(() => items.value[0])

const handleItemClick = (event: MenuItemCommandEvent) => {
  event.item.command?.(event)
}
</script>

<style>
.subgraph-breadcrumb {
  .p-breadcrumb-item-link,
  .p-breadcrumb-item-icon {
    color: #d26565;
  }
}
</style>
