<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import {
  getWidgetName,
  isWidgetPromotedOnSubgraphNode,
  reorderSubgraphInputsByWidgetOrder
} from '@/core/graph/subgraph/promotionUtils'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import CollapseToggleButton from '@/components/rightSidePanel/layout/CollapseToggleButton.vue'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import { searchWidgets } from '../shared'
import type { NodeWidgetsList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { node } = defineProps<{
  node: SubgraphNode
}>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { focusedSection, searchQuery } = storeToRefs(rightSidePanelStore)

const advancedInputsCollapsed = ref(true)
const firstSectionCollapsed = ref(false)
const isAllCollapsed = computed({
  get() {
    const hasAdvanced = advancedInputsWidgets.value.length > 0
    return hasAdvanced
      ? firstSectionCollapsed.value && advancedInputsCollapsed.value
      : firstSectionCollapsed.value
  },
  set(collapse: boolean) {
    firstSectionCollapsed.value = collapse
    advancedInputsCollapsed.value = collapse
  }
})
const advancedInputsSectionRef = useTemplateRef('advancedInputsSectionRef')

watch(
  focusedSection,
  async (section) => {
    if (section === 'advanced-inputs') {
      advancedInputsCollapsed.value = false
      rightSidePanelStore.clearFocusedSection()

      await nextTick()

      await new Promise((resolve) => setTimeout(resolve, 300))

      const sectionComponent = advancedInputsSectionRef.value
      const sectionElement = sectionComponent?.rootElement
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  },
  { immediate: true }
)

const widgetsList = computed((): NodeWidgetsList => {
  return promotedInputWidgets(node).map((widget) => ({ node, widget }))
})

const advancedInputsWidgets = computed((): NodeWidgetsList => {
  const interiorNodes = node.subgraph.nodes

  const allInteriorWidgets = interiorNodes.flatMap((interiorNode) => {
    const { widgets = [] } = interiorNode
    return widgets
      .filter((w) => !w.computedDisabled)
      .map((widget) => ({ node: interiorNode, widget }))
  })

  return allInteriorWidgets.filter(
    ({ node: interiorNode, widget }) =>
      !isWidgetPromotedOnSubgraphNode(node, {
        sourceNodeId: interiorNode.id,
        sourceWidgetName: getWidgetName(widget)
      })
  )
})

const parents = computed<SubgraphNode[]>(() => [node])

const searchedWidgetsList = shallowRef<NodeWidgetsList>(widgetsList.value)
const isSearching = ref(false)

async function searcher(query: string) {
  isSearching.value = query.trim() !== ''
  searchedWidgetsList.value = searchWidgets(widgetsList.value, query)
}

function handleReorder({
  fromIndex,
  toIndex
}: {
  fromIndex: number
  toIndex: number
}) {
  const widgets = searchedWidgetsList.value.map((row) => row.widget)
  const [moved] = widgets.splice(fromIndex, 1)
  if (!moved) return
  widgets.splice(toIndex, 0, moved)

  reorderSubgraphInputsByWidgetOrder(node, widgets)
  canvasStore.canvas?.setDirty(true, true)
}

const label = computed(() => {
  return searchedWidgetsList.value.length !== 0
    ? t('rightSidePanel.inputs')
    : t('rightSidePanel.inputsNone')
})
</script>

<template>
  <div
    class="flex items-center border-b border-interface-stroke px-4 pt-1 pb-4"
  >
    <AsyncSearchInput
      v-model="searchQuery"
      :searcher
      :update-key="widgetsList"
      class="flex-1"
    />
    <CollapseToggleButton
      v-model="isAllCollapsed"
      :show="!isSearching && advancedInputsWidgets.length > 0"
    />
  </div>
  <SectionWidgets
    :collapse="firstSectionCollapsed && !isSearching"
    :node
    :label
    :parents
    :widgets="searchedWidgetsList"
    :is-draggable="!isSearching"
    :enable-empty-state="isSearching"
    :tooltip="
      isSearching || searchedWidgetsList.length
        ? ''
        : t('rightSidePanel.inputsNoneTooltip')
    "
    class="border-b border-interface-stroke"
    @update:collapse="(v) => (firstSectionCollapsed = v)"
    @reorder="handleReorder"
  >
    <template #empty>
      <div class="px-4 pt-5 pb-15 text-center text-sm text-muted-foreground">
        {{ t('rightSidePanel.noneSearchDesc') }}
      </div>
    </template>
  </SectionWidgets>
  <SectionWidgets
    v-if="advancedInputsWidgets.length > 0"
    ref="advancedInputsSectionRef"
    v-model:collapse="advancedInputsCollapsed"
    :label="t('rightSidePanel.advancedInputs')"
    :parents="parents"
    :widgets="advancedInputsWidgets"
    show-node-name
    class="border-b border-interface-stroke"
  />
</template>
