<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
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

const isMultipleNodesSelected = computed(
  () => widgetsSectionDataList.value.length > 1
)

const isSingleSubgraphSelected = computed(() => {
  return nodes.length === 1 && nodes[0].isSubgraphNode()
})

const advancedInputsWidgets = computed((): NodeWidgetsList => {
  if (!isSingleSubgraphSelected.value) return []

  const subgraphNode = nodes[0] as SubgraphNode
  const interiorNodes = subgraphNode.subgraph.nodes
  const proxyWidgets = parseProxyWidgets(subgraphNode.properties.proxyWidgets)

  // Get all widgets from interior nodes
  const allInteriorWidgets = interiorNodes.flatMap((node) => {
    const { widgets = [] } = node
    return widgets
      .filter((w) => !w.computedDisabled)
      .map((widget) => ({ node, widget }))
  })

  // Filter out widgets that are already promoted using tuple matching
  return allInteriorWidgets.filter(({ node, widget }) => {
    return !proxyWidgets.some(
      ([nodeId, widgetName]) => node.id == nodeId && widget.name === widgetName
    )
  })
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
    v-for="{ widgets, node } in searchedWidgetsSectionDataList"
    :key="node.id"
    :node
    :parents
    :widgets
    :label="
      isMultipleNodesSelected
        ? undefined
        : widgets.length === 0
          ? t('rightSidePanel.inputsNone')
          : t('rightSidePanel.inputs')
    "
    :default-collapse="isMultipleNodesSelected && !isSearching"
    :show-locate-button="isMultipleNodesSelected"
    class="border-b border-interface-stroke"
  />
  <SectionWidgets
    v-if="isSingleSubgraphSelected && advancedInputsWidgets.length > 0"
    v-model:collapse="advancedInputsCollapsed"
    :label="t('rightSidePanel.advancedInputs')"
    :parents="parents"
    :widgets="advancedInputsWidgets"
    :default-collapse="advancedInputsCollapsed"
    show-node-name
    data-section="advanced-inputs"
    class="border-b border-interface-stroke"
  />
</template>
