<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, shallowRef, watch } from 'vue'

import DraggableList from '@/components/common/DraggableList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import {
  demoteWidget,
  getPromotableWidgets,
  isRecommendedWidget,
  promoteWidget,
  pruneDisconnected,
  reorderSubgraphInputsByWidgetOrder
} from '@/core/graph/subgraph/promotionUtils'
import {
  promotedInputSource,
  promotedInputWidget
} from '@/core/graph/subgraph/promotedInputWidget'
import type { PromotedSource } from '@/core/graph/subgraph/promotedInputWidget'
import type { WidgetItem } from '@/core/graph/subgraph/promotionUtils'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import type {
  INodeInputSlot,
  ISubgraphInput
} from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import { useLitegraphService } from '@/services/litegraphService'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@comfyorg/tailwind-utils'

import SubgraphNodeWidget from './SubgraphNodeWidget.vue'

type PromotedRow = {
  kind: 'promoted'
  node: LGraphNode
  input: INodeInputSlot & Partial<ISubgraphInput>
  widget: IBaseWidget
}
type PreviewRow = {
  kind: 'preview'
  node: LGraphNode
  exposure: PreviewExposure
  realWidget?: IBaseWidget
}
type ActiveRow = PromotedRow | PreviewRow

const canvasStore = useCanvasStore()
const previewExposureStore = usePreviewExposureStore()
const rightSidePanelStore = useRightSidePanelStore()
const { searchQuery } = storeToRefs(rightSidePanelStore)
const { shouldRenderVueNodes } = useVueFeatureFlags()

const activeNode = computed(() => {
  const node = canvasStore.selectedItems[0]
  if (node instanceof SubgraphNode) return node
  return undefined
})

const promotedRows = shallowRef<readonly PromotedRow[]>([])
function buildPromotedRows(node: SubgraphNode): PromotedRow[] {
  return node.inputs.flatMap((input): PromotedRow[] => {
    const widget = promotedInputWidget(input)
    if (!widget) return []
    const source = promotedInputSource(node, input)
    if (!source) return []
    const sourceNode = node.subgraph._nodes_by_id[source.nodeId]
    if (!sourceNode) return []
    return [{ kind: 'promoted', node: sourceNode, input, widget }]
  })
}
function refreshPromotedRows() {
  const node = activeNode.value
  promotedRows.value = node ? buildPromotedRows(node) : []
}
watch(activeNode, refreshPromotedRows, { immediate: true })
useEventListener(
  () => activeNode.value?.subgraph.events,
  [
    'widget-promoted',
    'widget-demoted',
    'input-added',
    'removing-input',
    'inputs-reordered'
  ],
  refreshPromotedRows
)

function promotedRowSource(row: PromotedRow): PromotedSource | undefined {
  const node = activeNode.value
  return node ? promotedInputSource(node, row.input) : undefined
}

const activeRows = computed<ActiveRow[]>(() => {
  const node = activeNode.value
  if (!node) return []
  return [...promotedRows.value, ...getActivePreviewRows(node)]
})

const activePromotedRows = computed<PromotedRow[]>({
  get() {
    return [...promotedRows.value]
  },
  set(value: PromotedRow[]) {
    updateActivePromotedRows(value, activePromotedRows.value)
  }
})

function getActivePreviewRows(node: SubgraphNode): PreviewRow[] {
  const hostLocator = String(node.id)
  const rootGraphId = node.rootGraph.id
  const exposures = previewExposureStore.getExposures(rootGraphId, hostLocator)
  return exposures.flatMap((exposure): PreviewRow[] => {
    const sourceNode = node.subgraph.getNodeById(exposure.sourceNodeId)
    if (!sourceNode) return []
    const realWidget = getPromotableWidgets(sourceNode).find(
      (candidate) => candidate.name === exposure.sourcePreviewName
    )
    return [{ kind: 'preview', node: sourceNode, exposure, realWidget }]
  })
}

function updateActivePromotedRows(
  value: PromotedRow[],
  currentItems: PromotedRow[]
) {
  const node = activeNode.value
  if (!node) {
    console.error('Attempted to toggle widgets with no node selected')
    return
  }
  const currentKeys = new Set(currentItems.map(promotedRowKey))
  const nextKeys = new Set(value.map(promotedRowKey))
  for (const item of value) {
    if (!currentKeys.has(promotedRowKey(item))) promotePromotedRow(item)
  }
  for (const item of currentItems) {
    if (!nextKeys.has(promotedRowKey(item))) demoteRow(item)
  }
  if (currentKeys.size === nextKeys.size) {
    reorderSubgraphInputsByWidgetOrder(
      node,
      value.map((row) => ({ widgetId: row.widget.widgetId }))
    )
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

function activeRowSourceKey(row: ActiveRow): string {
  if (row.kind !== 'promoted')
    return `${row.exposure.sourceNodeId}:${row.exposure.sourcePreviewName}`

  const source = promotedRowSource(row)
  return `${source?.nodeId ?? row.node.id}:${source?.widgetName ?? ''}`
}

const candidateWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  const promotedSourceKeys = new Set(activeRows.value.map(activeRowSourceKey))
  return interiorWidgets.value
    .filter(([n, w]) => !promotedSourceKeys.has(`${n.id}:${w.name}`))
    .filter(
      ([, w]) =>
        w.name.startsWith('$$') ||
        !(w.options.canvasOnly && shouldRenderVueNodes.value)
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

function rowMatchesQuery(row: ActiveRow, query: string): boolean {
  return (
    row.node.title.toLowerCase().includes(query) ||
    rowDisplayName(row).toLowerCase().includes(query)
  )
}

const filteredActive = computed<ActiveRow[]>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return activeRows.value
  return activeRows.value.filter((row) => rowMatchesQuery(row, query))
})

const filteredActivePromoted = computed<PromotedRow[]>(() =>
  filteredActive.value.filter(
    (row): row is PromotedRow => row.kind === 'promoted'
  )
)

const filteredActivePreviews = computed<PreviewRow[]>(() =>
  filteredActive.value.filter(
    (row): row is PreviewRow => row.kind === 'preview'
  )
)

function refreshPromotedWidgetRendering() {
  const node = activeNode.value
  if (!node) return

  node.computeSize(node.size)
  node.setDirtyCanvas(true, true)
  canvasStore.canvas?.setDirty(true, true)
}

function rowDisplayName(row: ActiveRow): string {
  if (row.kind === 'promoted') {
    return row.widget.label || row.widget.name
  }
  return (
    row.realWidget?.label ||
    row.realWidget?.name ||
    row.exposure.sourcePreviewName
  )
}

function isRowLinked(row: ActiveRow): boolean {
  return row.kind === 'promoted'
}

function promotedRowKey(row: PromotedRow): string {
  return `${row.node.id}: ${row.widget.name}`
}

function rowKey(row: ActiveRow): string {
  return row.kind === 'promoted'
    ? promotedRowKey(row)
    : `${row.node.id}: ${row.exposure.name}`
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return getPromotableWidgets(n).map((w) => [n, w])
}

function demoteRow(row: ActiveRow) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return
  if (row.kind === 'promoted') {
    const subgraphSlot = row.input._subgraphSlot
    if (subgraphSlot) {
      if (row.input.link != null) subgraphSlot.disconnect()
      else subgraphNode.subgraph.removeInput(subgraphSlot)
    }
    refreshPromotedWidgetRendering()
    return
  }
  if (row.realWidget) {
    demoteWidget(row.node, row.realWidget, [subgraphNode])
    return
  }
  previewExposureStore.removeExposure(
    subgraphNode.rootGraph.id,
    String(subgraphNode.id),
    row.exposure.name
  )
  refreshPromotedWidgetRendering()
}

function promotePromotedRow(row: PromotedRow) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return
  const source = promotedRowSource(row)
  const sourceWidget = source
    ? row.node.widgets?.find((widget) => widget.name === source.widgetName)
    : undefined
  if (sourceWidget) promoteWidget(row.node, sourceWidget, [subgraphNode])
}

function promoteCandidate([node, widget]: WidgetItem) {
  const subgraphNode = activeNode.value
  if (!subgraphNode) return
  promoteWidget(node, widget, [subgraphNode])
  refreshPromotedRows()
}

function showAll() {
  for (const item of filteredCandidates.value) {
    promoteCandidate(item)
  }
}
function hideAll() {
  for (const row of filteredActive.value) {
    if (String(row.node.id) === '-1') continue
    demoteRow(row)
  }
}
function showRecommended() {
  for (const item of recommendedWidgets.value) {
    promoteCandidate(item)
  }
}

onMounted(() => {
  if (activeNode.value) pruneDisconnected(activeNode.value)
})
</script>

<template>
  <div v-if="activeNode" class="subgraph-edit-section flex h-full flex-col">
    <div class="flex gap-2 border-b border-interface-stroke px-4 pt-1 pb-4">
      <AsyncSearchInput v-model="searchQuery" />
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
        <DraggableList v-slot="{ dragClass }" v-model="activePromotedRows">
          <SubgraphNodeWidget
            v-for="row in filteredActivePromoted"
            :key="rowKey(row)"
            :data-nodeid="row.node.id"
            :class="cn(!searchQuery && dragClass, 'bg-comfy-menu-bg')"
            :node-title="row.node.title"
            :widget-name="rowDisplayName(row)"
            :is-physical="isRowLinked(row)"
            :is-draggable="!searchQuery"
            is-shown
            @toggle-visibility="demoteRow(row)"
          />
        </DraggableList>
        <div class="mt-0.5 space-y-0.5 px-2 pb-2">
          <SubgraphNodeWidget
            v-for="row in filteredActivePreviews"
            :key="rowKey(row)"
            :data-nodeid="row.node.id"
            class="bg-comfy-menu-bg"
            :node-title="row.node.title"
            :widget-name="rowDisplayName(row)"
            :is-physical="isRowLinked(row)"
            :is-draggable="false"
            is-shown
            @toggle-visibility="demoteRow(row)"
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
            :key="`${node.id}:${widget.name}`"
            :data-nodeid="node.id"
            class="bg-comfy-menu-bg"
            :node-title="node.title"
            :widget-name="widget.name"
            @toggle-visibility="promoteCandidate([node, widget])"
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
