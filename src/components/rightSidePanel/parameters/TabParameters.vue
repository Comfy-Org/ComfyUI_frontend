<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'

import { searchWidgets } from '../layout'
import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import SidePanelSearch from '../layout/SidePanelSearch.vue'
import GroupSettings from '../settings/GroupSettings.vue'
import SectionWidgets from './SectionWidgets.vue'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const canvasStore = useCanvasStore()
const { selectedItems } = storeToRefs(canvasStore)

type NodeWidgetsList = Array<{ node: LGraphNode; widget: IBaseWidget }>
type NodeWidgetsListList = Array<{
  node: LGraphNode
  widgets: NodeWidgetsList
}>

const selectedGroup = computed((): LGraphGroup | null => {
  if (selectedItems.value.length === 1) {
    const item = selectedItems.value[0] as Positionable
    if (isLGraphGroup(item)) {
      return item as unknown as LGraphGroup
    }
  }
  return null
})

const effectiveNodes = computed((): LGraphNode[] => {
  if (selectedGroup.value) {
    return Array.from(selectedGroup.value._children).filter(
      (child): child is LGraphNode => isLGraphNode(child)
    )
  }
  return nodes
})

const widgetsSectionDataList = computed((): NodeWidgetsListList => {
  return effectiveNodes.value.map((node) => {
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
  <PropertiesAccordionItem
    v-if="
      selectedGroup && widgetsSectionDataList === searchedWidgetsSectionDataList
    "
    class="border-b border-interface-stroke"
  >
    <template #label>
      {{ $t('g.settings') }}
    </template>
    <div class="px-4">
      <GroupSettings :group="selectedGroup" />
    </div>
  </PropertiesAccordionItem>
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
