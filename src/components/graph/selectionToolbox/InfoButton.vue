<template>
  <Button
    v-show="nodeDef"
    v-tooltip.top="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    class="help-button"
    text
    severity="secondary"
    @click="toggleHelp"
  >
    <i-lucide:info :size="16" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { useCanvasStore } from '@/stores/graphStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const canvasStore = useCanvasStore()
const nodeDefStore = useNodeDefStore()
const sidebarTabStore = useSidebarTabStore()
const nodeHelpStore = useNodeHelpStore()
const { id: nodeLibraryTabId } = useNodeLibrarySidebarTab()

const nodeDef = computed<ComfyNodeDefImpl | null>(() => {
  if (canvasStore.selectedItems.length !== 1) return null
  const item = canvasStore.selectedItems[0]
  if (!isLGraphNode(item)) return null
  return nodeDefStore.fromLGraphNode(item)
})

const toggleHelp = () => {
  const def = nodeDef.value
  if (!def) return

  const isSidebarActive =
    sidebarTabStore.activeSidebarTabId === nodeLibraryTabId
  const currentHelpNode = nodeHelpStore.currentHelpNode as any
  const isSameNodeHelpOpen =
    isSidebarActive &&
    nodeHelpStore.isHelpOpen &&
    currentHelpNode &&
    currentHelpNode.nodePath === def.nodePath

  // If the sidebar is already showing this node's help, close both.
  if (isSameNodeHelpOpen) {
    nodeHelpStore.closeHelp()
    sidebarTabStore.toggleSidebarTab(nodeLibraryTabId) // closes (sets null)
    return
  }

  // Ensure sidebar is open
  if (!isSidebarActive) {
    sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
  }
  nodeHelpStore.openHelp(def)
}
</script>
