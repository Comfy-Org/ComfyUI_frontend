<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import NodeAppearanceSection from '@/components/rightSidePanel/sections/NodeAppearanceSection.vue'
import NodeInfoSection from '@/components/rightSidePanel/sections/NodeInfoSection.vue'
import NodeWidgetsSection from '@/components/rightSidePanel/sections/NodeWidgetsSection.vue'
import SubgraphEditSection from '@/components/rightSidePanel/sections/SubgraphEditSection.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
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
  if (!hasSelection.value) return t('rightSidePanel.Properties')
  if (isSingleNodeSelected.value && selectedNode.value) {
    return selectedNode.value.title || selectedNode.value.type || 'Node'
  }
  return t('rightSidePanel.multipleSelection', { count: selectionCount })
})

function closePanel() {
  rightSidePanelStore.closePanel()
}

const activeTab = ref<string>('parameters')
</script>

<template>
  <div class="flex h-full w-full flex-col bg-interface-panel-surface">
    <!-- Panel Header -->
    <div class="border-b border-interface-stroke pt-1">
      <div class="flex items-center justify-between pl-4 pr-3">
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
      <div v-if="hasSelection" class="px-4 pb-2 pt-1">
        <TabList v-model="activeTab">
          <Tab class="text-xs py-1 px-2" value="parameters">
            {{ t('rightSidePanel.parameters') }}
          </Tab>
          <Tab class="text-xs py-1 px-2" value="appearance">
            {{ t('rightSidePanel.appearance') }}
          </Tab>
          <Tab class="text-xs py-1 px-2" value="info">
            {{ t('rightSidePanel.info') }}
          </Tab>
        </TabList>
      </div>
    </div>

    <!-- Panel Content -->
    <div v-if="selectedNode" class="scrollbar-thin flex-1 overflow-y-auto">
      <div
        v-if="!hasSelection"
        class="flex h-full items-center justify-center text-center"
      >
        <div class="px-4 text-sm text-base-foreground-muted">
          {{ $t('rightSidePanel.noSelection') }}
        </div>
      </div>

      <template v-if="activeTab === 'parameters'">
        <NodeWidgetsSection :nodes="selectedNodes" />
        <!-- Subgraph Edit Section (if subgraph node) -->
        <SubgraphEditSection v-if="isSubgraphNode" />
      </template>
      <NodeInfoSection
        v-else-if="activeTab === 'info'"
        :nodes="selectedNodes"
      />
      <NodeAppearanceSection
        v-else-if="activeTab === 'appearance'"
        :nodes="selectedNodes"
      />
    </div>
  </div>
</template>
