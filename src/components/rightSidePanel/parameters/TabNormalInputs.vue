<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import CollapseToggleButton from '@/components/rightSidePanel/layout/CollapseToggleButton.vue'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'

import { computedSectionDataList, searchWidgetsAndNodes } from '../shared'
import type { NodeWidgetsListList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes, mustShowNodeTitle } = defineProps<{
  mustShowNodeTitle?: boolean
  nodes: LGraphNode[]
}>()

const { t } = useI18n()
const searchQuery = ref('')

const { widgetsSectionDataList, includesAdvanced } = computedSectionDataList(
  () => nodes
)

const advancedWidgetsSectionDataList = computed((): NodeWidgetsListList => {
  if (includesAdvanced.value) {
    return []
  }
  return nodes
    .map((node) => {
      const { widgets = [] } = node
      const advancedWidgets = widgets
        .filter(
          (w) =>
            !(w.options?.canvasOnly || w.options?.hidden) && w.options?.advanced
        )
        .map((widget) => ({ node, widget }))
      return { widgets: advancedWidgets, node }
    })
    .filter(({ widgets }) => widgets.length > 0)
})

const isMultipleNodesSelected = computed(
  () => widgetsSectionDataList.value.length > 1
)

const searchedWidgetsSectionDataList = shallowRef<NodeWidgetsListList>(
  widgetsSectionDataList.value
)
const isSearching = ref(false)

const collapseMap = reactive<Record<string, boolean>>({})
const advancedCollapsed = ref(true)

function isSectionCollapsed(nodeId: string): boolean {
  // When not explicitly set, sections are collapsed if multiple nodes are selected
  return collapseMap[nodeId] ?? isMultipleNodesSelected.value
}

function setSectionCollapsed(nodeId: string, collapsed: boolean) {
  collapseMap[nodeId] = collapsed
}

const isAllCollapsed = computed({
  get() {
    const normalAllCollapsed = searchedWidgetsSectionDataList.value.every(
      ({ node }) => isSectionCollapsed(String(node.id))
    )
    const hasAdvanced = advancedWidgetsSectionDataList.value.length > 0
    return hasAdvanced
      ? normalAllCollapsed && advancedCollapsed.value
      : normalAllCollapsed
  },
  set(collapse: boolean) {
    for (const { node } of widgetsSectionDataList.value) {
      setSectionCollapsed(String(node.id), collapse)
    }
    advancedCollapsed.value = collapse
  }
})

async function searcher(query: string) {
  const list = widgetsSectionDataList.value
  const target = searchedWidgetsSectionDataList
  isSearching.value = query.trim() !== ''
  target.value = searchWidgetsAndNodes(list, query)
}

const label = computed(() => {
  const sections = widgetsSectionDataList.value
  return !mustShowNodeTitle && sections.length === 1
    ? sections[0].widgets.length !== 0
      ? t('rightSidePanel.inputs')
      : t('rightSidePanel.inputsNone')
    : undefined // SectionWidgets display node titles by default
})

const advancedLabel = computed(() => {
  return !mustShowNodeTitle && !isMultipleNodesSelected.value
    ? t('rightSidePanel.advancedInputs')
    : undefined // SectionWidgets display node titles by default
})
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
      :show="
        !isSearching &&
        widgetsSectionDataList.length + advancedWidgetsSectionDataList.length >
          1
      "
    />
  </div>
  <TransitionGroup tag="div" name="list-scale" class="relative">
    <div
      v-if="searchedWidgetsSectionDataList.length === 0"
      class="px-4 py-10 text-center text-sm text-muted-foreground"
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
      :collapse="isSectionCollapsed(String(node.id)) && !isSearching"
      :show-locate-button="isMultipleNodesSelected"
      :tooltip="
        isSearching || widgets.length
          ? ''
          : t('rightSidePanel.inputsNoneTooltip')
      "
      class="border-b border-interface-stroke"
      @update:collapse="setSectionCollapsed(String(node.id), $event)"
    />
  </TransitionGroup>
  <template v-if="advancedWidgetsSectionDataList.length > 0 && !isSearching">
    <SectionWidgets
      v-for="{ widgets, node } in advancedWidgetsSectionDataList"
      :key="`advanced-${node.id}`"
      v-model:collapse="advancedCollapsed"
      :node
      :label="advancedLabel"
      :widgets
      :show-locate-button="isMultipleNodesSelected"
      class="border-b border-interface-stroke"
    />
  </template>
</template>
