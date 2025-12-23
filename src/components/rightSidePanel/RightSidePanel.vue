<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, toValue, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import type { RightSidePanelTab } from '@/stores/workspace/rightSidePanelStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

import TabInfo from './info/TabInfo.vue'
import TabGlobalParameters from './parameters/TabGlobalParameters.vue'
import TabNodes from './parameters/TabNodes.vue'
import TabParameters from './parameters/TabParameters.vue'
import TabGlobalSettings from './settings/TabGlobalSettings.vue'
import TabSettings from './settings/TabSettings.vue'
import SubgraphEditor from './subgraph/SubgraphEditor.vue'

const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { t } = useI18n()

const { selectedItems } = storeToRefs(canvasStore)
const { activeTab, isEditingSubgraph } = storeToRefs(rightSidePanelStore)

const hasSelection = computed(() => selectedItems.value.length > 0)

const selectedNodes = computed((): LGraphNode[] => {
  return selectedItems.value.filter(isLGraphNode)
})

const isSubgraphNode = computed(() => {
  return selectedNode.value instanceof SubgraphNode
})

const isSingleNodeSelected = computed(() => selectedNodes.value.length === 1)

const selectedNode = computed(() => {
  return isSingleNodeSelected.value ? selectedNodes.value[0] : null
})

const selectionCount = computed(() => selectedItems.value.length)

const rootLevelNodes = computed((): LGraphNode[] => {
  return (canvasStore.canvas?.graph?._nodes ?? []) as LGraphNode[]
})

const panelTitle = computed(() => {
  if (isSingleNodeSelected.value && selectedNode.value) {
    return selectedNode.value.title || selectedNode.value.type || 'Node'
  }
  if (selectionCount.value === 0) {
    return t('rightSidePanel.workflowOverview')
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
  const list: RightSidePanelTabList = []

  list.push({
    label: () => t('rightSidePanel.parameters'),
    value: 'parameters'
  })

  if (!hasSelection.value) {
    list.push({
      label: () => t('rightSidePanel.nodes'),
      value: 'nodes'
    })
  }

  if (hasSelection.value) {
    if (isSingleNodeSelected.value && !isSubgraphNode.value) {
      list.push({
        label: () => t('rightSidePanel.info'),
        value: 'info'
      })
    }
  }

  list.push({
    label: () =>
      hasSelection.value
        ? t('g.settings')
        : t('rightSidePanel.globalSettings.title'),
    value: 'settings'
  })

  return list
})

// Use global state for activeTab and ensure it's valid
watchEffect(() => {
  if (
    !tabs.value.some((tab) => tab.value === activeTab.value) &&
    !(activeTab.value === 'subgraph' && isSubgraphNode.value)
  ) {
    rightSidePanelStore.openPanel(tabs.value[0].value)
  }
})

const isEditing = ref(false)

function handleTitleEdit(newTitle: string) {
  isEditing.value = false

  const trimmedTitle = newTitle.trim()
  if (!trimmedTitle) return

  const node = toValue(selectedNode)
  if (!node) return

  if (trimmedTitle === node.title) return

  node.title = trimmedTitle
  canvasStore.canvas?.setDirty(true, false)
}

function handleTitleCancel() {
  isEditing.value = false
}
</script>

<template>
  <div
    data-testid="properties-panel"
    class="flex size-full flex-col bg-interface-panel-surface"
  >
    <!-- Panel Header -->
    <section class="pt-1">
      <div class="flex items-center justify-between pl-4 pr-3">
        <h3 class="my-3.5 text-sm font-semibold line-clamp-2">
          <EditableText
            v-if="isSingleNodeSelected"
            :model-value="panelTitle"
            :is-editing="isEditing"
            :input-attrs="{ 'data-testid': 'node-title-input' }"
            @edit="handleTitleEdit"
            @cancel="handleTitleCancel"
            @dblclick="isEditing = true"
          />
          <template v-else>
            {{ panelTitle }}
          </template>
        </h3>

        <div class="flex gap-2">
          <Button
            v-if="isSubgraphNode"
            variant="secondary"
            size="icon"
            :class="cn(isEditingSubgraph && 'bg-secondary-background-selected')"
            @click="
              rightSidePanelStore.openPanel(
                isEditingSubgraph ? 'parameters' : 'subgraph'
              )
            "
          >
            <i class="icon-[lucide--settings-2]" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            :aria-pressed="rightSidePanelStore.isOpen"
            :aria-label="t('rightSidePanel.togglePanel')"
            @click="closePanel"
          >
            <i class="icon-[lucide--panel-right] size-4" />
          </Button>
        </div>
      </div>
      <nav class="px-4 pb-2 pt-1">
        <TabList
          :model-value="activeTab"
          @update:model-value="
            (newTab: RightSidePanelTab) => {
              rightSidePanelStore.openPanel(newTab)
            }
          "
        >
          <Tab
            v-for="tab in tabs"
            :key="tab.value"
            class="text-sm py-1 px-2 font-inter"
            :value="tab.value"
          >
            {{ tab.label() }}
          </Tab>
        </TabList>
      </nav>
    </section>

    <!-- Panel Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <template v-if="!hasSelection">
        <TabGlobalParameters v-if="activeTab === 'parameters'" />
        <TabNodes v-else-if="activeTab === 'nodes'" :nodes="rootLevelNodes" />
        <TabGlobalSettings v-else-if="activeTab === 'settings'" />
      </template>
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
          :nodes="selectedItems"
        />
      </template>
    </div>
  </div>
</template>
