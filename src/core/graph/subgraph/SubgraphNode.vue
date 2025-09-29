<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { computed, customRef, ref } from 'vue'
import draggable from 'vuedraggable'

import SearchBox from '@/components/common/SearchBox.vue'
import SubgraphNodeWidget from '@/core/graph/subgraph/SubgraphNodeWidget.vue'
import {
  type ProxyWidgetsProperty,
  parseProxyWidgets
} from '@/core/schemas/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogStore } from '@/stores/dialogStore'

type WidgetItem = [LGraphNode, IBaseWidget]

const canvasStore = useCanvasStore()

const searchQuery = ref<string>('')
const debouncedQuery = refDebounced(searchQuery, 200)

function toKey(item: WidgetItem) {
  return `${item[0].id}: ${item[1].name}`
}

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
    const pw: ProxyWidgetsProperty = value.map(([node, widget]) => [
      `${node.id}`,
      widget.name
    ])
    proxyWidgets.value = pw
  }
})
function toggleVisibility(
  nodeId: string,
  widgetName: string,
  isShown: boolean
) {
  const node = activeNode.value
  if (!node)
    throw new Error('Attempted to toggle widgets with no node selected')
  if (!isShown) {
    const pw = proxyWidgets.value
    pw.push([nodeId, widgetName])
    proxyWidgets.value = pw
  } else {
    proxyWidgets.value = proxyWidgets.value.filter(
      (p: [string, string]) => p[1] !== widgetName || p[0] !== nodeId
    )
  }
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  if (!n.widgets) return []
  return n.widgets.map((w: IBaseWidget) => [n, w])
}

const interiorWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const interiorNodes = node.subgraph.nodes
  return interiorNodes
    .flatMap(nodeWidgets)
    .filter(([_, w]: WidgetItem) => !w.computedDisabled)
})

const proxyWidgets = customRef<ProxyWidgetsProperty>((track, trigger) => ({
  get() {
    track()
    const node = activeNode.value
    if (!node) return []
    return parseProxyWidgets(node.properties.proxyWidgets)
  },
  set(value: ProxyWidgetsProperty) {
    trigger()
    const node = activeNode.value
    if (!node) {
      console.error('Attempted to toggle widgets with no node selected')
      return
    }
    node.properties.proxyWidgets = JSON.stringify(value)
  }
}))

const candidateWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const pw = proxyWidgets.value
  return interiorWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      !pw.some(([pn, pw]: [string, string]) => n.id == pn && w.name == pw)
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
function showAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  const pw = proxyWidgets.value
  const toAdd: ProxyWidgetsProperty = filteredCandidates.value.map(
    ([n, w]: WidgetItem) => [`${n.id}`, w.name]
  )
  pw.push(...toAdd)
  proxyWidgets.value = pw
}
function hideAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  //Not great from a nesting perspective, but path is cold
  //and it cleans up potential error states
  proxyWidgets.value = proxyWidgets.value.filter(
    ([nodeId, widgetName]) =>
      !filteredActive.value.some(
        ([n, w]: WidgetItem) => n.id == nodeId && w.name === widgetName
      )
  )
}
const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']
const recommendedWidgets = computed(() => {
  const node = activeNode.value
  if (!node) return [] //Not reachable
  return filteredCandidates.value.filter(
    ([node, widget]: WidgetItem) =>
      recommendedNodes.includes(node.type) ||
      recommendedWidgetNames.includes(widget.name)
  )
})
function showRecommended() {
  const node = activeNode.value
  if (!node) return //Not reachable
  const pw = proxyWidgets.value
  const toAdd: ProxyWidgetsProperty = recommendedWidgets.value.map(
    ([n, w]: WidgetItem) => [`${n.id}`, w.name]
  )
  //TODO: Add sort step here
  //Input should always be before output by default
  pw.push(...toAdd)
  proxyWidgets.value = pw
}

const filteredActive = computed<WidgetItem[]>(() => {
  const query = debouncedQuery.value.toLowerCase()
  if (!query) return activeWidgets.value
  return activeWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})
</script>
<template>
  <SearchBox
    v-model:model-value="searchQuery"
    class="model-lib-search-box p-2 2xl:p-4"
    :placeholder="$t('g.search') + '...'"
  />
  <div
    v-if="filteredActive.length"
    class="pt-1 pb-4 border-b-1 border-[var(--color-node-divider,#2E3037)]"
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
          @toggle-visibility="
            toggleVisibility(`${widgetItem[0].id}`, widgetItem[1].name, true)
          "
        />
      </div>
    </div>
    <draggable
      v-else
      v-model="activeWidgets"
      group="enabledWidgets"
      class="w-full cursor-grab"
      chosen-class="cursor-grabbing"
      drag-class="cursor-grabbing"
      :animation="100"
      item-key="id"
    >
      <template #item="{ element }">
        <SubgraphNodeWidget
          :node-title="element[0].title"
          :widget-name="element[1].name"
          :is-shown="true"
          :is-draggable="true"
          @toggle-visibility="
            toggleVisibility(`${element[0].id}`, element[1].name, true)
          "
        />
      </template>
    </draggable>
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
        @toggle-visibility="
          toggleVisibility(`${widgetItem[0].id}`, widgetItem[1].name, false)
        "
      />
    </div>
  </div>
  <div
    v-if="recommendedWidgets.length"
    class="justify-center flex py-4 border-t-1 border-[var(--color-node-divider,#2E3037)]"
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
