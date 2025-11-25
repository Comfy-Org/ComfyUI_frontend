<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

import SubgraphEditor from './SubgraphEditor.vue'
import TabAppearance from './appearance/TabAppearance.vue'
import TabInfo from './info/TabInfo.vue'
import TabParameters from './parameters/TabParameters.vue'

const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { t } = useI18n()

const { selectedItems } = storeToRefs(canvasStore)

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
  if (!hasSelection.value) return t('rightSidePanel.Properties')
  if (isSingleNodeSelected.value && selectedNode.value) {
    return selectedNode.value.title || selectedNode.value.type || 'Node'
  }
  return t('rightSidePanel.multipleSelection', { count: selectionCount.value })
})

function closePanel() {
  rightSidePanelStore.closePanel()
}

const isEditingSubgraph = ref(false)

const tabs = computed<{ label: () => string; value: string }[]>(() => {
  const list = [
    {
      label: () => t('rightSidePanel.parameters'),
      value: 'parameters'
    },
    {
      label: () => t('rightSidePanel.appearance'),
      value: 'appearance'
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
const activeTab = ref<string>(tabs.value[0].value)
watchEffect(() => {
  if (!tabs.value.some((tab) => tab.value === activeTab.value)) {
    activeTab.value = tabs.value[0].value
  }
})
</script>

<template>
  <div class="flex h-full w-full flex-col bg-interface-panel-surface">
    <!-- Panel Header -->
    <div class="border-b border-interface-stroke pt-1">
      <div class="flex items-center justify-between pl-4 pr-3">
        <h3 class="my-3.5 text-sm font-semibold line-clamp-2">
          {{ panelTitle }}
        </h3>

        <div class="flex gap-2">
          <IconButton
            v-if="isSubgraphNode"
            type="transparent"
            size="sm"
            class="bg-secondary-background hover:bg-secondary-background-hover"
            :class="
              cn(
                'bg-secondary-background hover:bg-secondary-background-hover',
                isEditingSubgraph
                  ? 'bg-secondary-background-selected'
                  : 'bg-secondary-background'
              )
            "
            @click="isEditingSubgraph = !isEditingSubgraph"
          >
            <i class="icon-[lucide--settings-2]" />
          </IconButton>
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
      </div>
      <div
        v-if="hasSelection && !(isSubgraphNode && isEditingSubgraph)"
        class="px-4 pb-2 pt-1"
      >
        <TabList v-model="activeTab">
          <Tab
            v-for="tab in tabs"
            :key="tab.value"
            class="text-xs py-1 px-2"
            :value="tab.value"
          >
            {{ tab.label() }}
          </Tab>
        </TabList>
      </div>
    </div>

    <!-- Panel Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <SubgraphEditor
        v-if="isSubgraphNode && isEditingSubgraph"
        :node="selectedNode"
      />
      <div
        v-else-if="!hasSelection"
        class="flex h-full items-center justify-center text-center"
      >
        <div class="px-4 text-sm text-base-foreground-muted">
          {{ $t('rightSidePanel.noSelection') }}
        </div>
      </div>
      <template v-else>
        <TabParameters
          v-if="activeTab === 'parameters'"
          :nodes="selectedNodes"
        />
        <TabInfo v-else-if="activeTab === 'info'" :nodes="selectedNodes" />
        <TabAppearance
          v-else-if="activeTab === 'appearance'"
          :nodes="selectedNodes"
        />
      </template>
    </div>
  </div>
</template>
