<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import { searchWidgets } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

type NodeWidgetsList = Array<{ node: LGraphNode; widget: IBaseWidget }>
type NodeWidgetsListList = Array<{
  node: LGraphNode
  widgets: NodeWidgetsList
}>

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

const isMultipleNodesSelected = computed(
  () => widgetsSectionDataList.value.length > 1
)

const searchedWidgetsSectionDataList = shallowRef<NodeWidgetsListList>([])
const isSearching = ref(false)
async function searcher(query: string) {
  const list = widgetsSectionDataList.value
  const target = searchedWidgetsSectionDataList
  if (query.trim() === '') {
    target.value = list
    isSearching.value = false
    return
  }
  target.value = list
    .map((item) => ({ ...item, widgets: searchWidgets(item.widgets, query) }))
    .filter((item) => item.widgets.length > 0)
  isSearching.value = true
}
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher :update-key="widgetsSectionDataList" />
  </div>
  <SectionWidgets
    v-for="{ node, widgets } in searchedWidgetsSectionDataList"
    :key="node.id"
    :node
    :widgets
    :default-collapse="!isSearching && isMultipleNodesSelected"
    show-locate-button
    class="border-b border-interface-stroke"
  />
</template>
