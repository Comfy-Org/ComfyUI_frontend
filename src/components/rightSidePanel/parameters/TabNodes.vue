<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'

import CollapseToggleButton from '@/components/rightSidePanel/layout/CollapseToggleButton.vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import { computedSectionDataList, searchWidgetsAndNodes } from '../shared'
import type { NodeWidgetsListList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const canvasStore = useCanvasStore()
const workflowStore = useWorkflowStore()

const nodes = computed((): LGraphNode[] => {
  // Depend on activeWorkflow to trigger recomputation when workflow changes
  void workflowStore.activeWorkflow?.path
  return (canvasStore.canvas?.graph?.nodes ?? []) as LGraphNode[]
})

const searchQuery = ref('')

const { widgetsSectionDataList } = computedSectionDataList(nodes)

const searchedWidgetsSectionDataList = shallowRef<NodeWidgetsListList>(
  widgetsSectionDataList.value
)
const isSearching = ref(false)

const collapseMap = reactive<Record<string, boolean>>({})

function isSectionCollapsed(nodeId: string): boolean {
  // Defaults to collapsed when not explicitly set by the user
  return collapseMap[nodeId] ?? true
}

function setSectionCollapsed(nodeId: string, collapsed: boolean) {
  collapseMap[nodeId] = collapsed
}

const isAllCollapsed = computed({
  get() {
    return searchedWidgetsSectionDataList.value.every(({ node }) =>
      isSectionCollapsed(String(node.id))
    )
  },
  set(collapse: boolean) {
    for (const { node } of widgetsSectionDataList.value) {
      setSectionCollapsed(String(node.id), collapse)
    }
  }
})

async function searcher(query: string) {
  const list = widgetsSectionDataList.value
  const target = searchedWidgetsSectionDataList
  isSearching.value = query.trim() !== ''
  target.value = searchWidgetsAndNodes(list, query)
}
</script>

<template>
  <div
    class="flex items-center border-b border-interface-stroke px-4 pt-1 pb-4"
  >
    <FormSearchInput
      v-model="searchQuery"
      :searcher
      :update-key="widgetsSectionDataList"
      class="flex-1"
    />
    <CollapseToggleButton
      v-model="isAllCollapsed"
      :show="!isSearching && widgetsSectionDataList.length > 1"
    />
  </div>
  <TransitionGroup tag="div" name="list-scale" class="relative">
    <div
      v-if="isSearching && searchedWidgetsSectionDataList.length === 0"
      class="px-4 pt-5 pb-15 text-center text-sm text-muted-foreground"
    >
      {{ $t('rightSidePanel.noneSearchDesc') }}
    </div>
    <SectionWidgets
      v-for="{ node, widgets } in searchedWidgetsSectionDataList"
      :key="node.id"
      :node
      :widgets
      :collapse="isSectionCollapsed(String(node.id)) && !isSearching"
      :tooltip="
        isSearching || widgets.length
          ? ''
          : $t('rightSidePanel.inputsNoneTooltip')
      "
      show-locate-button
      class="border-b border-interface-stroke"
      @update:collapse="setSectionCollapsed(String(node.id), $event)"
    />
  </TransitionGroup>
</template>
