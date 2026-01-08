<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import { searchWidgetsAndNodes } from '../shared'
import type { NodeWidgetsListList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes, mustShowNodeTitle } = defineProps<{
  mustShowNodeTitle?: boolean
  nodes: LGraphNode[]
}>()

const { t } = useI18n()

const widgetsSectionDataList = computed((): NodeWidgetsListList => {
  return nodes.map((node) => {
    const { widgets = [] } = node
    const shownWidgets = widgets
      .filter((w) => !(w.options?.canvasOnly || w.options?.hidden))
      .map((widget) => ({ node, widget }))

    return { widgets: shownWidgets, node }
  })
})

const isMultipleNodesSelected = computed(
  () => widgetsSectionDataList.value.length > 1
)

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

const label = computed(() => {
  const nodes = widgetsSectionDataList.value
  return !mustShowNodeTitle && nodes.length === 1
    ? nodes[0].widgets.length !== 0
      ? t('rightSidePanel.inputs')
      : t('rightSidePanel.inputsNone')
    : undefined // SectionWidgets display node titles by default
})
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher :update-key="widgetsSectionDataList" />
  </div>
  <TransitionGroup tag="div" name="list-scale" class="relative">
    <div
      v-if="searchedWidgetsSectionDataList.length === 0"
      class="text-sm text-muted-foreground px-4 py-10 text-center"
    >
      {{
        isSearching
          ? t('rightSidePanel.noneSearchDesc')
          : t('rightSidePanel.nodesNoneDesc')
      }}
    </div>
    <SectionWidgets
      v-for="{ widgets, node } in searchedWidgetsSectionDataList"
      :key="node.id"
      :node
      :label
      :widgets
      :default-collapse="isMultipleNodesSelected && !isSearching"
      :show-locate-button="isMultipleNodesSelected"
      class="border-b border-interface-stroke"
    />
  </TransitionGroup>
</template>
