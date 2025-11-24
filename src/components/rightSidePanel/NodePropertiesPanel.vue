<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import NodeAppearanceSection from '@/components/rightSidePanel/sections/NodeAppearanceSection.vue'
import NodeInfoSection from '@/components/rightSidePanel/sections/NodeInfoSection.vue'
import NodeWidgetsSection from '@/components/rightSidePanel/sections/NodeWidgetsSection.vue'
import SubgraphEditSection from '@/components/rightSidePanel/sections/SubgraphEditSection.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { t } = useI18n()

const { selectedItems } = storeToRefs(canvasStore)

const hasSelection = computed(() => selectedItems.value.length > 0)

const selectedNodes = computed(() => {
  return selectedItems.value.filter(isLGraphNode) as LGraphNode[]
})

const isSingleNodeSelected = computed(() => selectedNodes.value.length === 1)

const selectedNode = computed(() => {
  return isSingleNodeSelected.value ? selectedNodes.value[0] : null
})

const isSubgraphNode = computed(() => {
  return selectedNode.value instanceof SubgraphNode
})

const selectionCount = computed(() => selectedItems.value.length)

const panelTitle = computed(() => {
  if (!hasSelection.value) return 'Properties'
  if (isSingleNodeSelected.value && selectedNode.value) {
    return selectedNode.value.title || selectedNode.value.type || 'Node'
  }
  return `${selectionCount.value} Items Selected`
})

function closePanel() {
  rightSidePanelStore.closePanel()
}
</script>

<template>
  <div class="flex h-full w-full flex-col bg-interface-panel-surface">
    <!-- Panel Header -->
    <div
      class="border-b border-interface-stroke pl-4 pr-3 flex items-center justify-between"
    >
      <h3 class="text-sm font-semibold">
        {{ panelTitle }}
      </h3>
      <IconButton
        type="transparent"
        size="sm"
        class="bg-secondary-background hover:bg-secondary-background-hover"
        :aria-pressed="rightSidePanelStore.isOpen"
        :aria-label="t('rightSidePanel.togglePanel')"
        @click="closePanel"
      >
        <i class="icon-[lucide--panel-right]" />
      </IconButton>
    </div>

    <!-- Panel Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
      <!-- No selection state -->
      <div
        v-if="!hasSelection"
        class="flex h-full items-center justify-center text-center"
      >
        <div class="px-4 text-sm text-base-foreground-muted">
          {{ $t('rightSidePanel.noSelection') }}
        </div>
      </div>

      <!-- Single node selected -->
      <div
        v-else-if="isSingleNodeSelected && selectedNode"
        class="flex flex-col gap-6"
      >
        <!-- Subgraph Edit Section (if subgraph node) -->
        <SubgraphEditSection v-if="isSubgraphNode" />

        <!-- Node Info Section -->
        <NodeInfoSection :node="selectedNode" />

        <!-- Widgets Section -->
        <NodeWidgetsSection :node="selectedNode" />

        <!-- Appearance Section -->
        <NodeAppearanceSection :node="selectedNode" />
      </div>

      <!-- Multiple nodes selected -->
      <div v-else class="flex flex-col gap-6">
        <div class="rounded-lg bg-interface-surface p-3 text-sm">
          {{
            $t('rightSidePanel.multipleSelection', { count: selectionCount })
          }}
        </div>

        <!-- Appearance controls for multiple nodes -->
        <NodeAppearanceSection :nodes="selectedNodes" />
      </div>
    </div>
  </div>
</template>
