<template>
  <div
    class="fixed top-[var(--comfy-topbar-height)] left-[var(--sidebar-width)] right-0 p-2 bg-[var(--comfy-menu-bg)] border-b border-[var(--border-color)] z-[900]"
  >
    <Breadcrumb
      :home="home"
      :model="items"
      aria-label="Graph navigation"
      @item-click="handleItemClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useWorkflowService } from '@/services/workflowService'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useWorkflowStore } from '@/stores/workflowStore'

const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const subgraphStore = useSubgraphStore()

type MenuItem = {
  label: string
  command?: () => void
  icon?: string
}

const items = computed<MenuItem[]>(() => {
  if (!subgraphStore.graphNamePath.length) return []

  return subgraphStore.graphNamePath.map((name, index) => ({
    label: name,
    icon:
      index === subgraphStore.graphNamePath.length - 1
        ? 'pi pi-home'
        : undefined,
    command: () => {
      const workflow = workflowStore.getWorkflowByPath(name)
      if (workflow) workflowService.openWorkflow(workflow)
    }
  }))
})

const home = computed(() => items.value[0])

const handleItemClick = (event: { item: MenuItem }) => {
  event.item.command?.()
}
</script>
