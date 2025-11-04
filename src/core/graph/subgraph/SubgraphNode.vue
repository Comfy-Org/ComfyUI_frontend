<script setup lang="ts">
import { refDebounced, watchDebounced } from '@vueuse/core'
import {
  computed,
  customRef,
  onBeforeUnmount,
  onMounted,
  ref,
  triggerRef
} from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import SubgraphNodeWidget from '@/core/graph/subgraph/SubgraphNodeWidget.vue'
import {
  demoteWidget,
  isRecommendedWidget,
  matchesPropertyItem,
  matchesWidgetItem,
  promoteWidget,
  pruneDisconnected,
  widgetItemToProperty
} from '@/core/graph/subgraph/proxyWidgetUtils'
import type { WidgetItem } from '@/core/graph/subgraph/proxyWidgetUtils'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { DraggableList } from '@/scripts/ui/draggableList'
import { useLitegraphService } from '@/services/litegraphService'
import { useDialogStore } from '@/stores/dialogStore'

const canvasStore = useCanvasStore()

const draggableList = ref<DraggableList | undefined>(undefined)
const draggableItems = ref()
const searchQuery = ref<string>('')
const debouncedQuery = refDebounced(searchQuery, 200)
const proxyWidgets = customRef<ProxyWidgetsProperty>((track, trigger) => ({
  get() {
    track()
    const node = activeNode.value
    if (!node) return []
    return parseProxyWidgets(node.properties.proxyWidgets)
  },
  set(value?: ProxyWidgetsProperty) {
    trigger()
    const node = activeNode.value
    if (!value) return
    if (!node) {
      console.error('Attempted to toggle widgets with no node selected')
      return
    }
    node.properties.proxyWidgets = value
  }
}))

const activeNode = computed(() => {
  const node = canvasStore.selectedItems[0]
  if (node instanceof SubgraphNode) return node
  useDialogStore().closeDialog()
  return undefined
})

const activeWidgets = computed<WidgetItem[]>({
  get() {
    if (!activeNode.value) return []
    const node = activeNode.value
    function mapWidgets([id, name]: [string, string]): WidgetItem[] {
      if (id === '-1') {
        const widget = node.widgets.find((w) => w.name === name)
        if (!widget) return []
        return [[{ id: -1, title: '(Linked)', type: '' }, widget]]
      }
      const wNode = node.subgraph._nodes_by_id[id]
      if (!wNode?.widgets) return []
      const widget = wNode.widgets.find((w) => w.name === name)
      if (!widget) return []
      return [[wNode, widget]]
    }
    return proxyWidgets.value.flatMap(mapWidgets)
  },
  set(value: WidgetItem[]) {
    const node = activeNode.value
    if (!node) {
      console.error('Attempted to toggle widgets with no node selected')
      return
    }
    proxyWidgets.value = value.map(widgetItemToProperty)
  }
})

const interiorWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const { updatePreviews } = useLitegraphService()
  const interiorNodes = node.subgraph.nodes
  for (const node of interiorNodes) {
    node.updateComputedDisabled()
    updatePreviews(node)
  }
  return interiorNodes
    .flatMap(nodeWidgets)
    .filter(([_, w]: WidgetItem) => !w.computedDisabled)
})

const candidateWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const widgets = proxyWidgets.value
  return interiorWidgets.value.filter(
    (widgetItem: WidgetItem) => !widgets.some(matchesPropertyItem(widgetItem))
  )
})
const filteredCandidates = computed<WidgetItem[]>(() => {
  const query = debouncedQuery.value.toLowerCase()
  if (!query) return candidateWidgets.value
  return candidateWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})

const recommendedWidgets = computed(() => {
  const node = activeNode.value
  if (!node) return [] //Not reachable
  return filteredCandidates.value.filter(isRecommendedWidget)
})

const filteredActive = computed<WidgetItem[]>(() => {
  const query = debouncedQuery.value.toLowerCase()
  if (!query) return activeWidgets.value
  return activeWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})

function toKey(item: WidgetItem) {
  return `${item[0].id}: ${item[1].name}`
}
function nodeWidgets(n: LGraphNode): WidgetItem[] {
  if (!n.widgets) return []
  return n.widgets.map((w: IBaseWidget) => [n, w])
}
function demote([node, widget]: WidgetItem) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return []
  demoteWidget(node, widget, [subgraphNode])
  triggerRef(proxyWidgets)
}
function promote([node, widget]: WidgetItem) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return []
  promoteWidget(node, widget, [subgraphNode])
  triggerRef(proxyWidgets)
}
function showAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  const widgets = proxyWidgets.value
  const toAdd: ProxyWidgetsProperty =
    filteredCandidates.value.map(widgetItemToProperty)
  widgets.push(...toAdd)
  proxyWidgets.value = widgets
}
function hideAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  proxyWidgets.value = proxyWidgets.value.filter(
    (propertyItem) =>
      !filteredActive.value.some(matchesWidgetItem(propertyItem)) ||
      propertyItem[0] === '-1'
  )
}
function showRecommended() {
  const node = activeNode.value
  if (!node) return //Not reachable
  const widgets = proxyWidgets.value
  const toAdd: ProxyWidgetsProperty =
    recommendedWidgets.value.map(widgetItemToProperty)
  //TODO: Add sort step here
  //Input should always be before output by default
  widgets.push(...toAdd)
  proxyWidgets.value = widgets
}

function setDraggableState() {
  draggableList.value?.dispose()
  if (debouncedQuery.value || !draggableItems.value?.children?.length) return
  draggableList.value = new DraggableList(
    draggableItems.value,
    '.draggable-item'
  )
  //Original implementation plays really poorly with vue,
  //It has been modified to not add/remove elements
  draggableList.value.applyNewItemsOrder = function () {
    const reorderedItems = []

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
        reorderedItems[index] = this.draggableItem
      }
    }
    const newPosition = reorderedItems.indexOf(this.draggableItem)
    const aw = activeWidgets.value
    const [w] = aw.splice(oldPosition, 1)
    aw.splice(newPosition, 0, w)
    activeWidgets.value = aw
  }
}
watchDebounced(
  filteredActive,
  () => {
    setDraggableState()
  },
  { debounce: 100 }
)
onMounted(() => {
  setDraggableState()
  if (activeNode.value) pruneDisconnected(activeNode.value)
})
onBeforeUnmount(() => {
  draggableList.value?.dispose()
})
</script>
<template>
  <SearchBox
    v-model:model-value="searchQuery"
    class="p-2"
    :placeholder="$t('g.search') + '...'"
  />
  <div
    v-if="filteredActive.length"
    class="border-b-1 border-node-component-border pt-1 pb-4"
  >
    <div class="flex justify-between px-4 py-0">
      <div class="text-[9px] font-semibold text-slate-100 uppercase">
        {{ $t('subgraphStore.shown') }}
      </div>
      <a
        class="cursor-pointer text-right text-[11px] font-normal text-azure-600"
        @click.stop="hideAll"
      >
        {{ $t('subgraphStore.hideAll') }}</a
      >
    </div>
    <div ref="draggableItems">
      <SubgraphNodeWidget
        v-for="[node, widget] in filteredActive"
        :key="toKey([node, widget])"
        :node-title="node.title"
        :widget-name="widget.name"
        :is-shown="true"
        :is-draggable="!debouncedQuery"
        :is-physical="node.id === -1"
        @toggle-visibility="demote([node, widget])"
      />
    </div>
  </div>
  <div v-if="filteredCandidates.length" class="pt-1 pb-4">
    <div class="flex justify-between px-4 py-0">
      <div class="text-[9px] font-semibold text-slate-100 uppercase">
        {{ $t('subgraphStore.hidden') }}
      </div>
      <a
        class="cursor-pointer text-right text-[11px] font-normal text-azure-600"
        @click.stop="showAll"
      >
        {{ $t('subgraphStore.showAll') }}</a
      >
    </div>
    <SubgraphNodeWidget
      v-for="[node, widget] in filteredCandidates"
      :key="toKey([node, widget])"
      :node-title="node.title"
      :widget-name="widget.name"
      @toggle-visibility="promote([node, widget])"
    />
  </div>
  <div
    v-if="recommendedWidgets.length"
    class="flex justify-center border-t-1 border-node-component-border py-4"
  >
    <Button
      size="small"
      class="rounded border-none px-3 py-0.5"
      @click.stop="showRecommended"
    >
      {{ $t('subgraphStore.showRecommended') }}
    </Button>
  </div>
</template>
