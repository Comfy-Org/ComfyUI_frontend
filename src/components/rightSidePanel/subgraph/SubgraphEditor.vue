<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import DraggableList from '@/components/common/DraggableList.vue'
import Button from '@/components/ui/button/Button.vue'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  demoteWidget,
  getPromotableWidgets,
  getSourceNodeId,
  getWidgetName,
  isLinkedPromotion,
  isRecommendedWidget,
  promoteWidget,
  pruneDisconnected,
  reorderSubgraphInputsByWidgetOrder
} from '@/core/graph/subgraph/promotionUtils'
import type { WidgetItem } from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import { useLitegraphService } from '@/services/litegraphService'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@comfyorg/tailwind-utils'

import SubgraphNodeWidget from './SubgraphNodeWidget.vue'

const canvasStore = useCanvasStore()
const previewExposureStore = usePreviewExposureStore()
const rightSidePanelStore = useRightSidePanelStore()
const { searchQuery } = storeToRefs(rightSidePanelStore)
const inputOrderVersion = ref(0)

const activeNode = computed(() => {
  const node = canvasStore.selectedItems[0]
  if (node instanceof SubgraphNode) return node
  return undefined
})

const activeWidgets = computed<WidgetItem[]>({
  get() {
    const node = activeNode.value
    if (!node) return []

    return [...getActivePromotedWidgets(node), ...getActivePreviewWidgets(node)]
  },
  set(value: WidgetItem[]) {
    updateActiveWidgets(value, activeWidgets.value)
  }
})

const activePromotedWidgets = computed<WidgetItem[]>({
  get() {
    const node = activeNode.value
    return node ? getActivePromotedWidgets(node) : []
  },
  set(value: WidgetItem[]) {
    updateActiveWidgets(value, activePromotedWidgets.value)
  }
})

function getActivePromotedWidgets(node: SubgraphNode): WidgetItem[] {
  void inputOrderVersion.value
  return node.widgets.flatMap((widget): WidgetItem[] => {
    if (!isPromotedWidgetView(widget)) return []
    const sourceNode = node.subgraph._nodes_by_id[widget.sourceNodeId]
    if (!sourceNode) return []
    return [[sourceNode, widget]]
  })
}

function getActivePreviewWidgets(node: SubgraphNode): WidgetItem[] {
  const hostLocator = String(node.id)
  return previewExposureStore
    .getExposures(node.rootGraph.id, hostLocator)
    .flatMap((exposure): WidgetItem[] => {
      const sourceNode = node.subgraph._nodes_by_id[exposure.sourceNodeId]
      if (!sourceNode) return []
      const widget = getPromotableWidgets(sourceNode).find(
        (candidate) => candidate.name === exposure.sourcePreviewName
      )
      return widget ? [[sourceNode, widget]] : []
    })
}

function updateActiveWidgets(value: WidgetItem[], currentItems: WidgetItem[]) {
  const node = activeNode.value
  if (!node) {
    console.error('Attempted to toggle widgets with no node selected')
    return
  }
  const currentKeys = new Set(currentItems.map(toKey))
  const nextKeys = new Set(value.map(toKey))
  for (const item of value) {
    if (!currentKeys.has(toKey(item))) promote(item)
  }
  for (const item of currentItems) {
    if (!nextKeys.has(toKey(item))) demote(item)
  }
  if (currentKeys.size === nextKeys.size) {
    reorderSubgraphInputsByWidgetOrder(
      node,
      value.map(([, widget]) => widget)
    )
    inputOrderVersion.value += 1
  }
  refreshPromotedWidgetRendering()
}

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
  return interiorWidgets.value.filter(
    (item: WidgetItem) =>
      !activeWidgets.value.some((active) => toKey(active) === toKey(item))
  )
})
const filteredCandidates = computed<WidgetItem[]>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return candidateWidgets.value
  return candidateWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})

const recommendedWidgets = computed(() => {
  const node = activeNode.value
  if (!node) return []
  return filteredCandidates.value.filter(isRecommendedWidget)
})

const filteredActive = computed<WidgetItem[]>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return activeWidgets.value
  return activeWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})

const filteredActivePromoted = computed<WidgetItem[]>(() =>
  filteredActive.value.filter(([, widget]) => isPromotedWidgetView(widget))
)

const filteredActivePreviews = computed<WidgetItem[]>(() =>
  filteredActive.value.filter(([, widget]) => !isPromotedWidgetView(widget))
)

function refreshPromotedWidgetRendering() {
  const node = activeNode.value
  if (!node) return

  node.computeSize(node.size)
  node.setDirtyCanvas(true, true)
  canvasStore.canvas?.setDirty(true, true)
}

function isItemLinked([node, widget]: WidgetItem): boolean {
  return (
    node.id === -1 ||
    (!!activeNode.value &&
      isLinkedPromotion(
        activeNode.value,
        String(node.id),
        getWidgetName(widget)
      ))
  )
}

function toKey(item: WidgetItem) {
  const sid = getSourceNodeId(item[1])
  return sid
    ? `${item[0].id}: ${item[1].name}:${sid}`
    : `${item[0].id}: ${item[1].name}`
}
function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return getPromotableWidgets(n).map((w) => [n, w])
}
function demote([node, widget]: WidgetItem) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return
  demoteWidget(node, widget, [subgraphNode])
}
function promote([node, widget]: WidgetItem) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return
  promoteWidget(node, widget, [subgraphNode])
}
function showAll() {
  for (const item of filteredCandidates.value) {
    promote(item)
  }
}
function hideAll() {
  const node = activeNode.value
  for (const item of filteredActive.value) {
    if (String(item[0].id) === '-1') continue
    if (
      node &&
      isLinkedPromotion(node, String(item[0].id), getWidgetName(item[1]))
    )
      continue
    demote(item)
  }
}
function showRecommended() {
  for (const item of recommendedWidgets.value) {
    promote(item)
  }
}

onMounted(() => {
  if (activeNode.value) pruneDisconnected(activeNode.value)
})
</script>

<template>
  <div v-if="activeNode" class="subgraph-edit-section flex h-full flex-col">
    <div class="flex gap-2 border-b border-interface-stroke px-4 pt-1 pb-4">
      <FormSearchInput v-model="searchQuery" />
    </div>

    <div class="flex-1">
      <div
        v-if="
          searchQuery &&
          filteredActive.length === 0 &&
          filteredCandidates.length === 0
        "
        class="px-4 py-10 text-center text-sm text-muted-foreground"
      >
        {{ $t('rightSidePanel.noneSearchDesc') }}
      </div>

      <div
        v-if="filteredActive.length"
        data-testid="subgraph-editor-shown-section"
        class="flex flex-col border-b border-interface-stroke"
      >
        <div
          class="sticky top-0 z-10 flex min-h-12 items-center justify-between px-4 backdrop-blur-xl"
        >
          <div class="line-clamp-1 text-sm font-semibold uppercase">
            {{ $t('subgraphStore.shown') }}
          </div>
          <a
            class="cursor-pointer text-right text-xs font-normal whitespace-nowrap text-text-secondary hover:text-azure-600"
            @click.stop="hideAll"
          >
            {{ $t('subgraphStore.hideAll') }}</a
          >
        </div>
        <DraggableList v-slot="{ dragClass }" v-model="activePromotedWidgets">
          <SubgraphNodeWidget
            v-for="[node, widget] in filteredActivePromoted"
            :key="toKey([node, widget])"
            :class="cn(!searchQuery && dragClass, 'bg-comfy-menu-bg')"
            :node-title="node.title"
            :widget-name="widget.label || widget.name"
            :is-physical="isItemLinked([node, widget])"
            :is-draggable="!searchQuery"
            @toggle-visibility="demote([node, widget])"
          />
        </DraggableList>
        <div class="mt-0.5 space-y-0.5 px-2 pb-2">
          <SubgraphNodeWidget
            v-for="[node, widget] in filteredActivePreviews"
            :key="toKey([node, widget])"
            class="bg-comfy-menu-bg"
            :node-title="node.title"
            :widget-name="widget.label || widget.name"
            :is-physical="isItemLinked([node, widget])"
            :is-draggable="false"
            @toggle-visibility="demote([node, widget])"
          />
        </div>
      </div>

      <div
        v-if="filteredCandidates.length"
        data-testid="subgraph-editor-hidden-section"
        class="flex flex-col border-b border-interface-stroke"
      >
        <div
          class="sticky top-0 z-10 flex min-h-12 items-center justify-between px-4 backdrop-blur-xl"
        >
          <div class="line-clamp-1 text-sm font-semibold uppercase">
            {{ $t('subgraphStore.hidden') }}
          </div>
          <a
            class="cursor-pointer text-right text-xs font-normal whitespace-nowrap text-text-secondary hover:text-azure-600"
            @click.stop="showAll"
          >
            {{ $t('subgraphStore.showAll') }}</a
          >
        </div>
        <div class="mt-0.5 space-y-0.5 px-2 pb-2">
          <SubgraphNodeWidget
            v-for="[node, widget] in filteredCandidates"
            :key="toKey([node, widget])"
            class="bg-comfy-menu-bg"
            :node-title="node.title"
            :widget-name="widget.name"
            @toggle-visibility="promote([node, widget])"
          />
        </div>
      </div>

      <div
        v-if="recommendedWidgets.length"
        class="flex justify-center border-b border-interface-stroke py-4"
      >
        <Button
          size="sm"
          class="rounded-sm border-none px-3 py-0.5"
          @click.stop="showRecommended"
        >
          {{ $t('subgraphStore.showRecommended') }}
        </Button>
      </div>
    </div>
  </div>
</template>
