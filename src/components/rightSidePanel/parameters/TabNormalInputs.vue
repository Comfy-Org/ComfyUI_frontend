<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import { searchWidgets } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const { t } = useI18n()
const rightSidePanelStore = useRightSidePanelStore()
const { focusedSection } = storeToRefs(rightSidePanelStore)

const advancedInputsCollapsed = ref(true)

watch(
  focusedSection,
  (section) => {
    if (section === 'advanced-inputs') {
      advancedInputsCollapsed.value = false
      rightSidePanelStore.clearFocusedSection()
    }
  },
  { immediate: true }
)

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

const isSingleSubgraphSelected = computed(() => {
  return nodes.length === 1 && nodes[0].isSubgraphNode()
})

const advancedInputsWidgets = computed((): NodeWidgetsList => {
  if (!isSingleSubgraphSelected.value) return []

  const subgraphNode = nodes[0] as SubgraphNode
  const interiorNodes = subgraphNode.subgraph.nodes

  // Get all widgets from interior nodes
  const allInteriorWidgets = interiorNodes.flatMap((node) => {
    const { widgets = [] } = node
    return widgets
      .filter((w) => !w.computedDisabled)
      .map((widget) => ({ node, widget }))
  })

  // Filter out widgets that are already promoted (shown in INPUTS section)
  const promotedWidgetNames = new Set(subgraphNode.widgets.map((w) => w.name))

  return allInteriorWidgets.filter(
    ({ widget }) => !promotedWidgetNames.has(widget.name)
  )
})

const parents = computed<SubgraphNode[]>(() => {
  if (!isSingleSubgraphSelected.value) return []

  const subgraphNode = nodes[0] as SubgraphNode
  return [subgraphNode]
})

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
  isSearching.value = true
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
    :parents="parents"
    :default-collapse="widgetsSectionDataList.length > 1 && !isSearching"
    :show-locate-button="widgetsSectionDataList.length > 1"
    :is-shown-on-parents="isSingleSubgraphSelected"
    class="border-b border-interface-stroke"
  />
  <SectionWidgets
    v-if="isSingleSubgraphSelected && advancedInputsWidgets.length > 0"
    v-model:collapse="advancedInputsCollapsed"
    :label="t('rightSidePanel.advancedInputs')"
    :parents="parents"
    :widgets="advancedInputsWidgets"
    :default-collapse="advancedInputsCollapsed"
    class="border-b border-interface-stroke"
    data-section="advanced-inputs"
    show-node-name
  />
</template>
