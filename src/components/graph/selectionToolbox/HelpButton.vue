<template>
  <Button
    v-show="hasNodeDef"
    v-tooltip.top="{
      value: $t('g.help'),
      showDelay: 1000
    }"
    class="help-button"
    text
    icon="pi pi-question-circle"
    severity="secondary"
    @click="showHelp"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { useNodeHelp } from '@/composables/useNodeHelp'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const canvasStore = useCanvasStore()
const nodeDefStore = useNodeDefStore()
const { openHelp } = useNodeHelp()
const sidebarTabStore = useSidebarTabStore()
const { id: nodeLibraryTabId } = useNodeLibrarySidebarTab()

const selectedNode = computed(() => {
  if (canvasStore.selectedItems.length !== 1) return null
  const item = canvasStore.selectedItems[0]
  return isLGraphNode(item) ? item : null
})

const nodeDef = computed(() => {
  const node = selectedNode.value
  if (!node) return null
  return nodeDefStore.fromLGraphNode(node)
})

const hasNodeDef = computed(() => nodeDef.value !== null)

const showHelp = () => {
  if (!hasNodeDef.value) return
  if (sidebarTabStore.activeSidebarTabId !== nodeLibraryTabId) {
    sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
  }
  openHelp(nodeDef.value!)
}
</script>
