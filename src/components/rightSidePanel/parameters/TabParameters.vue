<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { searchWidgets } from '../layout'
import SidePanelSearch from '../layout/SidePanelSearch.vue'
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

const searchedWidgetsSectionDataList = shallowRef<NodeWidgetsListList>([])

async function searcher(query: string) {
  const list = widgetsSectionDataList.value
  const target = searchedWidgetsSectionDataList
  if (query.trim() === '') {
    target.value = list
    return
  }
  target.value = list
    .map((item) => ({ ...item, widgets: searchWidgets(item.widgets, query) }))
    .filter((item) => item.widgets.length > 0)
}
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher :update-key="widgetsSectionDataList" />
  </div>
  <SectionWidgets
    v-for="section in searchedWidgetsSectionDataList"
    :key="section.node.id"
    :label="widgetsSectionDataList.length > 1 ? section.node.title : undefined"
    :widgets="section.widgets"
    :default-collapse="
      widgetsSectionDataList.length > 1 &&
      widgetsSectionDataList === searchedWidgetsSectionDataList
    "
    class="border-b border-interface-stroke"
  />
</template>
