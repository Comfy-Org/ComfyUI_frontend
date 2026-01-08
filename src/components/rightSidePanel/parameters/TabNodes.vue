<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import { searchWidgetsAndNodes } from '../shared'
import type { NodeWidgetsListList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const rightSidePanelStore = useRightSidePanelStore()
const { searchQuery } = storeToRefs(rightSidePanelStore)

const widgetsSectionDataList = computed((): NodeWidgetsListList => {
  return nodes.map((node) => {
    const { widgets = [] } = node
    const shownWidgets = widgets
      .filter((w) => !(w.options?.canvasOnly || w.options?.hidden))
      .map((widget) => ({ node, widget }))
    return {
      widgets: shownWidgets,
      node
    }
  })
})

const searchedWidgetsSectionDataList = shallowRef<NodeWidgetsListList>(
  widgetsSectionDataList.value
)
const isSearching = ref(false)
async function searcher(query: string) {
  const list = widgetsSectionDataList.value
  const target = searchedWidgetsSectionDataList
  isSearching.value = query.trim() !== ''
  target.value = searchWidgetsAndNodes(list, query)
}
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch
      v-model="searchQuery"
      :searcher
      :update-key="widgetsSectionDataList"
    />
  </div>
  <TransitionGroup tag="div" name="list-scale" class="relative">
    <div
      v-if="isSearching && searchedWidgetsSectionDataList.length === 0"
      class="text-sm text-muted-foreground px-4 text-center pt-5 pb-15"
    >
      {{ $t('rightSidePanel.noneSearchDesc') }}
    </div>
    <SectionWidgets
      v-for="{ node, widgets } in searchedWidgetsSectionDataList"
      :key="node.id"
      :node
      :widgets
      :default-collapse="!isSearching"
      show-locate-button
      class="border-b border-interface-stroke"
    />
  </TransitionGroup>
</template>
