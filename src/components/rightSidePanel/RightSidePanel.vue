<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import type { RightSidePanelTab } from '@/stores/workspace/rightSidePanelStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

import TabInfo from './info/TabInfo.vue'
import TabParameters from './parameters/TabParameters.vue'
import TabSettings from './settings/TabSettings.vue'
import SubgraphEditor from './subgraph/SubgraphEditor.vue'

const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { t } = useI18n()

const { selectedItems } = storeToRefs(canvasStore)
const { activeTab, isEditingSubgraph } = storeToRefs(rightSidePanelStore)

const hasSelection = computed(() => selectedItems.value.length > 0)

const selectedNodes = computed(() => {
  return selectedItems.value.filter(isLGraphNode) as LGraphNode[]
})

const isSubgraphNode = computed(() => {
  return selectedNode.value instanceof SubgraphNode
})

const isSingleNodeSelected = computed(() => selectedNodes.value.length === 1)

const selectedNode = computed(() => {
  return isSingleNodeSelected.value ? selectedNodes.value[0] : null
})

const selectionCount = computed(() => selectedItems.value.length)

const panelTitle = computed(() => {
  if (isSingleNodeSelected.value && selectedNode.value) {
    return selectedNode.value.title || selectedNode.value.type || 'Node'
  }
  return t('rightSidePanel.title', { count: selectionCount.value })
})

function closePanel() {
  rightSidePanelStore.closePanel()
}

type RightSidePanelTabList = Array<{
  label: () => string
  value: RightSidePanelTab
}>

const tabs = computed<RightSidePanelTabList>(() => {
  const list: RightSidePanelTabList = [
    {
      label: () => t('rightSidePanel.parameters'),
      value: 'parameters'
    },
    {
      label: () => t('g.settings'),
      value: 'settings'
    }
  ]
  if (
    !hasSelection.value ||
    (isSingleNodeSelected.value && !isSubgraphNode.value)
  ) {
    list.push({
      label: () => t('rightSidePanel.info'),
      value: 'info'
    })
  }
  return list
})

// Use global state for activeTab and ensure it's valid
watchEffect(() => {
  if (!tabs.value.some((tab) => tab.value === activeTab.value)) {
    activeTab.value = tabs.value[0].value as 'parameters' | 'settings' | 'info'
  }
})
</script>

<template>
  <div class="flex size-full flex-col bg-interface-panel-surface">
    <!-- Panel Header -->
    <section class="pt-1">
      <div class="flex items-center justify-between pl-4 pr-3">
        <h3 class="my-3.5 text-sm font-semibold line-clamp-2">
          {{ panelTitle }}
        </h3>

        <div class="flex gap-2">
          <IconButton
            v-if="isSubgraphNode"
            type="transparent"
            size="sm"
            class="bg-secondary-background hover:bg-secondary-background-hover text-base-foreground"
            :class="
              cn(
                'bg-secondary-background hover:bg-secondary-background-hover',
                isEditingSubgraph
                  ? 'bg-secondary-background-selected'
                  : 'bg-secondary-background'
              )
            "
            @click="
              rightSidePanelStore.openPanel(
                isEditingSubgraph ? 'parameters' : 'subgraph'
              )
            "
          >
            <i class="icon-[lucide--settings-2]" />
          </IconButton>
          <IconButton
            type="transparent"
            size="sm"
            class="bg-secondary-background hover:bg-secondary-background-hover text-base-foreground"
            :aria-pressed="rightSidePanelStore.isOpen"
            :aria-label="t('rightSidePanel.togglePanel')"
            @click="closePanel"
          >
            <i class="icon-[lucide--panel-right] size-4" />
          </IconButton>
        </div>
      </div>
      <nav v-if="hasSelection" class="px-4 pb-2 pt-1">
        <TabList
          v-model="activeTab"
          @update:model-value="
            (newTab) => {
              rightSidePanelStore.openPanel(newTab as RightSidePanelTab)
            }
          "
        >
          <Tab
            v-for="tab in tabs"
            :key="tab.value"
            class="text-sm py-1 px-2"
            :value="tab.value"
          >
            {{ tab.label() }}
          </Tab>
        </TabList>
      </nav>
    </section>

    <!-- Panel Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <div
        v-if="!hasSelection"
        class="flex size-full p-4 items-start justify-start text-sm text-muted-foreground"
      >
        {{ $t('rightSidePanel.noSelection') }}
      </div>
      <SubgraphEditor
        v-else-if="isSubgraphNode && isEditingSubgraph"
        :node="selectedNode"
      />
      <template v-else>
        <TabParameters
          v-if="activeTab === 'parameters'"
          :nodes="selectedNodes"
        />
        <TabInfo v-else-if="activeTab === 'info'" :nodes="selectedNodes" />
        <TabSettings
          v-else-if="activeTab === 'settings'"
          :nodes="selectedNodes"
        />
      </template>
    </div>
  </div>
</template>
