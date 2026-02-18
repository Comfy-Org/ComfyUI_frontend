<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  computed,
  customRef,
  nextTick,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import { searchWidgets } from '../shared'
import type { NodeWidgetsList } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { node } = defineProps<{
  node: SubgraphNode
}>()

const emit = defineEmits<{
  'update:proxyWidgets': [value: ProxyWidgetsProperty]
}>()

const { t } = useI18n()
const rightSidePanelStore = useRightSidePanelStore()
const { focusedSection, searchQuery } = storeToRefs(rightSidePanelStore)

const advancedInputsCollapsed = ref(true)
const advancedInputsSectionRef = useTemplateRef('advancedInputsSectionRef')

// Use customRef to track proxyWidgets changes
const proxyWidgets = customRef<ProxyWidgetsProperty>((track, trigger) => ({
  get() {
    track()
    return parseProxyWidgets(node.properties.proxyWidgets)
  },
  set(value?: ProxyWidgetsProperty) {
    trigger()
    if (!value) return
    emit('update:proxyWidgets', value)
  }
}))

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
  const proxyWidgetsOrder = proxyWidgets.value
  const { widgets = [] } = node

  // Map proxyWidgets to actual proxy widgets in the correct order
  const result: NodeWidgetsList = []
  for (const [nodeId, widgetName] of proxyWidgetsOrder) {
    // Find the proxy widget that matches this nodeId and widgetName
    const widget = widgets.find((w) => {
      // Check if this is a proxy widget with _overlay
      if (isProxyWidget(w)) {
        return (
          String(w._overlay.nodeId) === nodeId &&
          w._overlay.widgetName === widgetName
        )
      }
      // For non-proxy widgets (like linked widgets), match by name
      return w.name === widgetName
    })
    if (widget) {
      result.push({ node, widget })
    }
  }
  return result
})

const advancedInputsWidgets = computed((): NodeWidgetsList => {
  const interiorNodes = node.subgraph.nodes
  const proxyWidgetsValue = parseProxyWidgets(node.properties.proxyWidgets)

  // Get all widgets from interior nodes
  const allInteriorWidgets = interiorNodes.flatMap((interiorNode) => {
    const { widgets = [] } = interiorNode
    return widgets
      .filter((w) => !w.computedDisabled)
      .map((widget) => ({ node: interiorNode, widget }))
  })

  // Filter out widgets that are already promoted using tuple matching
  return allInteriorWidgets.filter(({ node: interiorNode, widget }) => {
    return !proxyWidgetsValue.some(
      ([nodeId, widgetName]) =>
        interiorNode.id == nodeId && widget.name === widgetName
    )
  })
})

const parents = computed<SubgraphNode[]>(() => [node])

const searchedWidgetsList = shallowRef<NodeWidgetsList>(widgetsList.value)
const isSearching = ref(false)

async function searcher(query: string) {
  isSearching.value = query.trim() !== ''
  searchedWidgetsList.value = searchWidgets(widgetsList.value, query)
}

const label = computed(() => {
  return searchedWidgetsList.value.length !== 0
    ? t('rightSidePanel.inputs')
    : t('rightSidePanel.inputsNone')
})
</script>

<template>
  <div class="px-4 pt-1 pb-4 flex gap-2 border-b border-interface-stroke">
    <FormSearchInput
      v-model="searchQuery"
      :searcher
      :update-key="widgetsList"
    />
  </div>
  <DraggableList v-model="proxyWidgets">
    <SectionWidgets
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
    >
      <template #empty>
        <div class="text-sm text-muted-foreground px-4 text-center pt-5 pb-15">
          {{ t('rightSidePanel.noneSearchDesc') }}
        </div>
      </template>
    </SectionWidgets>
  </DraggableList>
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
