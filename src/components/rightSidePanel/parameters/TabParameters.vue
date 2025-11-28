<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import SectionWidgets from './SectionWidgets.vue'

const props = defineProps<{
  nodes: LGraphNode[]
}>()

const widgetsSectionDataList = computed(() => {
  const list: {
    widgets: { node: LGraphNode; widget: IBaseWidget }[]
    node: LGraphNode
  }[] = []
  for (const node of props.nodes) {
    const shownWidgets: IBaseWidget[] = []
    for (const widget of node.widgets ?? []) {
      if (widget.options?.canvasOnly || widget.options?.hidden) continue
      shownWidgets.push(widget)
    }
    list.push({
      widgets: shownWidgets?.map((widget) => ({ node, widget })) ?? [],
      node
    })
  }
  return list
})

const searchedWidgetsSectionDataList = shallowRef<
  {
    widgets: { node: LGraphNode; widget: IBaseWidget }[]
    node: LGraphNode
  }[]
>([])

/**
 * Searches widgets in all selected nodes and returns search results.
 * Filters by name, localized label, type, and user-input value.
 * Performs basic tokenization of the query string.
 */
async function searcher(query: string) {
  if (query.trim() === '') {
    searchedWidgetsSectionDataList.value = widgetsSectionDataList.value
    return
  }
  const words = query.trim().toLowerCase().split(' ')
  searchedWidgetsSectionDataList.value = widgetsSectionDataList.value
    .map((item) => {
      return {
        ...item,
        widgets: item.widgets.filter(({ widget }) => {
          const label = widget.label?.toLowerCase()
          const name = widget.name.toLowerCase()
          const type = widget.type.toLowerCase()
          const value = widget.value?.toString().toLowerCase()
          return words.every(
            (word) =>
              name.includes(word) ||
              label?.includes(word) ||
              type?.includes(word) ||
              value?.includes(word)
          )
        })
      }
    })
    .filter((item) => item.widgets.length > 0)
}
</script>

<template>
  <div class="p-4 flex gap-2 border-b border-interface-stroke">
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
