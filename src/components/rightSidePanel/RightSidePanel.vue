<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, provide, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useGraphHierarchy } from '@/composables/graph/useGraphHierarchy'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import type { RightSidePanelTab } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@/utils/tailwindUtil'

import TabInfo from './info/TabInfo.vue'
import TabGlobalParameters from './parameters/TabGlobalParameters.vue'
import TabNodes from './parameters/TabNodes.vue'
import TabNormalInputs from './parameters/TabNormalInputs.vue'
import TabSubgraphInputs from './parameters/TabSubgraphInputs.vue'
import TabGlobalSettings from './settings/TabGlobalSettings.vue'
import TabSettings from './settings/TabSettings.vue'
import {
  GetNodeParentGroupKey,
  useFlatAndCategorizeSelectedItems
} from './shared'
import SubgraphEditor from './subgraph/SubgraphEditor.vue'

const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const settingStore = useSettingStore()
const { t } = useI18n()
const { findParentGroup } = useGraphHierarchy()

const { selectedItems: directlySelectedItems } = storeToRefs(canvasStore)
const { activeTab, isEditingSubgraph } = storeToRefs(rightSidePanelStore)

const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

// Panel is on the left when sidebar is on the right, and vice versa
const panelIcon = computed(() =>
  sidebarLocation.value === 'right'
    ? 'icon-[lucide--panel-left]'
    : 'icon-[lucide--panel-right]'
)

const { flattedItems, selectedNodes, selectedGroups, nodeToParentGroup } =
  useFlatAndCategorizeSelectedItems(directlySelectedItems)

const shouldShowGroupNames = computed(() => {
  return !(
    directlySelectedItems.value.length === 1 &&
    (selectedGroups.value.length === 1 || selectedNodes.value.length === 1)
  )
})

provide(GetNodeParentGroupKey, (node: LGraphNode) => {
  if (!shouldShowGroupNames.value) return null
  return nodeToParentGroup.value.get(node) ?? findParentGroup(node)
})

const hasSelection = computed(() => flattedItems.value.length > 0)

const selectedSingleNode = computed(() => {
  return selectedNodes.value.length === 1 && flattedItems.value.length === 1
    ? selectedNodes.value[0]
    : null
})

const isSingleSubgraphNode = computed(() => {
  return selectedSingleNode.value instanceof SubgraphNode
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
    label: () =>
      flattedItems.value.length > 1
        ? t('rightSidePanel.nodes')
        : t('rightSidePanel.parameters'),
    value: 'parameters'
  })

  if (!hasSelection.value) {
    list.push({
      label: () => t('rightSidePanel.nodes'),
      value: 'nodes'
    })
  }

  if (hasSelection.value) {
    if (selectedSingleNode.value && !isSingleSubgraphNode.value) {
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
    !(activeTab.value === 'subgraph' && isSingleSubgraphNode.value)
  ) {
    rightSidePanelStore.openPanel(tabs.value[0].value)
  }
})

function resolveTitle() {
  const items = flattedItems.value
  const nodes = selectedNodes.value
  const groups = selectedGroups.value

  if (items.length === 0) {
    return t('rightSidePanel.workflowOverview')
  }
  if (directlySelectedItems.value.length === 1) {
    if (groups.length === 1) {
      return groups[0].title || t('rightSidePanel.fallbackGroupTitle')
    }
    if (nodes.length === 1) {
      return (
        nodes[0].title || nodes[0].type || t('rightSidePanel.fallbackNodeTitle')
      )
    }
  }
  return t('rightSidePanel.title', { count: items.length })
}

const panelTitle = ref(resolveTitle())
watchEffect(() => (panelTitle.value = resolveTitle()))

const isEditing = ref(false)

const allowTitleEdit = computed(() => {
  return (
    directlySelectedItems.value.length === 1 &&
    (selectedGroups.value.length === 1 || selectedNodes.value.length === 1)
  )
})

function handleTitleEdit(newTitle: string) {
  isEditing.value = false

  const trimmedTitle = newTitle.trim()
  if (!trimmedTitle) return

  const node = selectedGroups.value[0] || selectedNodes.value[0]
  if (!node) return

  if (trimmedTitle === node.title) return

  node.title = trimmedTitle
  panelTitle.value = trimmedTitle
  canvasStore.canvas?.setDirty(true, true)
}

function handleTitleCancel() {
  isEditing.value = false
}
</script>

<template>
  <div
    data-testid="properties-panel"
    class="flex size-full flex-col bg-comfy-menu-bg"
  >
    <!-- Panel Header -->
    <section class="pt-1">
      <div class="flex items-center justify-between pr-3 pl-4">
        <h3 class="my-3.5 line-clamp-2 cursor-default text-sm font-semibold">
          <template v-if="allowTitleEdit">
            <EditableText
              :model-value="panelTitle"
              :is-editing="isEditing"
              :input-attrs="{ 'data-testid': 'node-title-input' }"
              class="cursor-text"
              @edit="handleTitleEdit"
              @cancel="handleTitleCancel"
              @click="isEditing = true"
            />
            <i
              v-if="!isEditing"
              class="relative top-[2px] ml-2 icon-[lucide--pencil] size-4 shrink-0 cursor-pointer content-center text-muted-foreground hover:text-base-foreground"
              @click="isEditing = true"
            />
          </template>
          <template v-else>
            {{ panelTitle }}
          </template>
        </h3>

        <div class="flex gap-2">
          <Button
            v-if="isSingleSubgraphNode"
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
            <i :class="cn(panelIcon, 'size-4')" />
          </Button>
        </div>
      </div>
      <nav class="overflow-x-auto px-4 pt-1 pb-2">
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
            class="px-2 py-1 font-inter text-sm transition-all active:scale-95"
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
        <TabNodes v-else-if="activeTab === 'nodes'" />
        <TabGlobalSettings v-else-if="activeTab === 'settings'" />
      </template>
      <SubgraphEditor
        v-else-if="isSingleSubgraphNode && isEditingSubgraph"
        :node="selectedSingleNode"
      />
      <template v-else>
        <TabSubgraphInputs
          v-if="activeTab === 'parameters' && isSingleSubgraphNode"
          :node="selectedSingleNode as SubgraphNode"
        />
        <TabNormalInputs
          v-else-if="activeTab === 'parameters'"
          :nodes="selectedNodes"
          :must-show-node-title="selectedGroups.length > 0"
        />
        <TabInfo
          v-else-if="activeTab === 'info'"
          :nodes="selectedNodes"
        />
        <TabSettings
          v-else-if="activeTab === 'settings'"
          :nodes="flattedItems"
        />
      </template>
    </div>
  </div>
</template>
