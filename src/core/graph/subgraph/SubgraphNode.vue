<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import {
  computed,
  customRef,
  onBeforeUnmount,
  onMounted,
  ref,
  triggerRef,
  watch
} from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import SubgraphNodeWidget from '@/core/graph/subgraph/SubgraphNodeWidget.vue'
import {
  type WidgetItem,
  demoteWidget,
  isRecommendedWidget,
  matchesPropertyItem,
  matchesWidgetItem,
  promoteWidget,
  widgetItemToProperty
} from '@/core/graph/subgraph/proxyWidgetUtils'
import {
  type ProxyWidgetsProperty,
  parseProxyWidgets
} from '@/core/schemas/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { DraggableList } from '@/scripts/ui/draggableList'
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
    const node = activeNode.value
    if (!node) return []
    return proxyWidgets.value.flatMap(([id, name]: [string, string]) => {
      const wNode = node.subgraph._nodes_by_id[id]
      if (!wNode?.widgets) return []
      const w = wNode.widgets.find((w) => w.name === name)
      if (!w) return []
      return [[wNode, w]]
    })
  },
  set(value: WidgetItem[]) {
    const node = activeNode.value
    if (!node) {
      console.error('Attempted to toggle widgets with no node selected')
      return
    }
    //map back to id/name
    const widgets: ProxyWidgetsProperty = value.map(widgetItemToProperty)
    proxyWidgets.value = widgets
  }
})

const interiorWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const interiorNodes = node.subgraph.nodes
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
  //Not great from a nesting perspective, but path is cold
  //and it cleans up potential error states
  proxyWidgets.value = proxyWidgets.value.filter(
    (widgetItem) => !filteredActive.value.some(matchesWidgetItem(widgetItem))
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
  draggableList.value.addEventListener(
    'dragend',
    // @ts-expect-error fixme ts strict error
    ({ detail: { oldPosition, newPosition } }) => {
      const aw = activeWidgets.value
      const [w] = aw.splice(oldPosition, 1)
      aw.splice(newPosition, 0, w)
      activeWidgets.value = aw
    }
  )
}
watch(filteredActive, () => {
  setTimeout(setDraggableState, 100)
})
onMounted(() => {
  setDraggableState()
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
    class="pt-1 pb-4 border-b-1 border-sand-100 dark-theme:border-charcoal-600"
  >
    <div class="flex py-0 px-4 justify-between">
      <div class="text-slate-100 text-[9px] font-semibold uppercase">
        {{ $t('subgraphStore.shown') }}
      </div>
      <a
        class="cursor-pointer text-right text-blue-100 text-[11px] font-normal"
        @click.stop="hideAll"
      >
        {{ $t('subgraphStore.hideAll') }}</a
      >
    </div>
    <div v-if="debouncedQuery" class="w-full">
      <div
        v-for="widgetItem in filteredActive"
        :key="toKey(widgetItem)"
        class="w-full"
      >
        <SubgraphNodeWidget
          :node-title="widgetItem[0].title"
          :widget-name="widgetItem[1].name"
          :is-shown="true"
          @toggle-visibility="demote(widgetItem)"
        />
      </div>
    </div>
    <div v-else ref="draggableItems" class="w-full">
      <div
        v-for="widgetItem in filteredActive"
        :key="toKey(widgetItem)"
        class="w-full"
      >
        <SubgraphNodeWidget
          :node-title="widgetItem[0].title"
          :widget-name="widgetItem[1].name"
          :is-shown="true"
          :is-draggable="true"
          @toggle-visibility="demote(widgetItem)"
        />
      </div>
    </div>
  </div>
  <div v-if="filteredCandidates.length" class="pt-1 pb-4">
    <div class="flex py-0 px-4 justify-between">
      <div class="text-slate-100 text-[9px] font-semibold uppercase">
        {{ $t('subgraphStore.hidden') }}
      </div>
      <a
        class="cursor-pointer text-right text-blue-100 text-[11px] font-normal"
        @click.stop="showAll"
      >
        {{ $t('subgraphStore.showAll') }}</a
      >
    </div>
    <div
      v-for="widgetItem in filteredCandidates"
      :key="toKey(widgetItem)"
      class="w-full"
    >
      <SubgraphNodeWidget
        :node-title="widgetItem[0].title"
        :widget-name="widgetItem[1].name"
        @toggle-visibility="promote(widgetItem)"
      />
    </div>
  </div>
  <div
    v-if="recommendedWidgets.length"
    class="justify-center flex py-4 border-t-1 border-sand-100 dark-theme:border-charcoal-600"
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
