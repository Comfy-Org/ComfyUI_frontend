<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  computed,
  customRef,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  triggerRef,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { DraggableList } from '@/scripts/ui/draggableList'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import SidePanelSearch from '../layout/SidePanelSearch.vue'
import { searchWidgets } from '../shared'
import SectionWidgets from './SectionWidgets.vue'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
const rightSidePanelStore = useRightSidePanelStore()
const { focusedSection } = storeToRefs(rightSidePanelStore)

const advancedInputsCollapsed = ref(true)
const draggableList = ref<DraggableList | undefined>(undefined)
const sectionWidgetsRef = useTemplateRef('sectionWidgetsRef')
const searchQuery = ref<string>('')

// For subgraph nodes, use customRef to track proxyWidgets changes
const proxyWidgets = customRef<ProxyWidgetsProperty>((track, trigger) => ({
  get() {
    track()
    if (!isSingleSubgraphSelected.value) return []
    const subgraphNode = nodes[0] as SubgraphNode
    return parseProxyWidgets(subgraphNode.properties.proxyWidgets)
  },
  set(value?: ProxyWidgetsProperty) {
    trigger()
    if (!value || !isSingleSubgraphSelected.value) return
    const subgraphNode = nodes[0] as SubgraphNode
    subgraphNode.properties.proxyWidgets = value
  }
}))

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
    let shownWidgets: NodeWidgetsList

    // For subgraph nodes, use proxyWidgets order
    if (isSingleSubgraphSelected.value) {
      const subgraphNode = node as SubgraphNode
      const proxyWidgetsOrder = proxyWidgets.value
      const { widgets = [] } = subgraphNode

      // Map proxyWidgets to actual proxy widgets in the correct order
      shownWidgets = proxyWidgetsOrder
        .map(([nodeId, widgetName]) => {
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
          if (!widget) return null
          return { node, widget }
        })
        .filter(
          (item): item is { node: LGraphNode; widget: IBaseWidget } =>
            item !== null
        )
    } else {
      const { widgets = [] } = node
      shownWidgets = widgets
        .filter((w) => !(w.options?.canvasOnly || w.options?.hidden))
        .map((widget) => ({ node, widget }))
    }

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
  searchQuery.value = query
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

function setDraggableState() {
  draggableList.value?.dispose()
  // useTemplateRef in v-for returns an array, so we access the first element
  const firstRef = Array.isArray(sectionWidgetsRef.value)
    ? sectionWidgetsRef.value[0]
    : sectionWidgetsRef.value
  const container = firstRef?.widgetsContainer
  if (
    searchQuery.value ||
    !container?.children?.length ||
    !isSingleSubgraphSelected.value
  )
    return

  draggableList.value = new DraggableList(container, '.draggable-item')

  draggableList.value.applyNewItemsOrder = function () {
    const reorderedItems: HTMLElement[] = []

    let oldPosition = -1
    this.getAllItems().forEach((item, index) => {
      if (item === this.draggableItem) {
        oldPosition = index
        return
      }
      if (!this.isItemToggled(item)) {
        reorderedItems[index] = item
        return
      }
      const newIndex = this.isItemAbove(item) ? index + 1 : index - 1
      reorderedItems[newIndex] = item
    })

    for (let index = 0; index < this.getAllItems().length; index++) {
      const item = reorderedItems[index]
      if (typeof item === 'undefined') {
        reorderedItems[index] = this.draggableItem as HTMLElement
      }
    }

    const newPosition = reorderedItems.indexOf(
      this.draggableItem as HTMLElement
    )

    // Update proxyWidgets order (similar to SubgraphEditor.vue)
    const pw = proxyWidgets.value
    const [w] = pw.splice(oldPosition, 1)
    pw.splice(newPosition, 0, w)
    proxyWidgets.value = pw
    canvasStore.canvas?.setDirty(true, true)
    triggerRef(proxyWidgets)
  }
}

watchDebounced(
  searchedWidgetsSectionDataList,
  () => {
    setDraggableState()
  },
  { debounce: 100 }
)

onMounted(() => {
  setDraggableState()
})

onBeforeUnmount(() => {
  draggableList.value?.dispose()
})
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher :update-key="widgetsSectionDataList" />
  </div>
  <SectionWidgets
    v-for="{ widgets, node } in searchedWidgetsSectionDataList"
    ref="sectionWidgetsRef"
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
    :is-draggable="isSingleSubgraphSelected && !isSearching"
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
