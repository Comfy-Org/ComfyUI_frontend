<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, provide, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildDropIndicator } from '@/components/builder/dropIndicatorUtil'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { OverlayAppendToKey } from '@/composables/useTransformCompatOverlayProps'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

interface WidgetEntry {
  key: string
  nodeData: ReturnType<typeof nodeToNodeData> & {
    widgets: NonNullable<ReturnType<typeof nodeToNodeData>['widgets']>
  }
  action: { widget: IBaseWidget; node: LGraphNode }
}

const {
  mobile = false,
  builderMode = false,
  zoneId,
  itemKeys
} = defineProps<{
  mobile?: boolean
  builderMode?: boolean
  /** When set, only show inputs assigned to this zone. */
  zoneId?: string
  /** When set, only render these specific input keys in the given order. */
  itemKeys?: string[]
}>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const appModeStore = useAppModeStore()
const maskEditor = useMaskEditor()

provide(HideLayoutFieldKey, true)
provide(OverlayAppendToKey, 'body')

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph?.nodes ?? [])
useEventListener(
  () => app.rootGraph?.events,
  'configured',
  () => (graphNodes.value = app.rootGraph?.nodes ?? [])
)

const groupedItemKeys = computed(() => {
  const keys = new Set<string>()
  for (const group of appModeStore.inputGroups) {
    for (const item of group.items) keys.add(item.key)
  }
  return keys
})

function resolveInputEntry(
  nodeId: string | number,
  widgetName: string,
  nodeDataByNode: Map<LGraphNode, ReturnType<typeof nodeToNodeData>>
): WidgetEntry | null {
  const [node, widget] = resolveNodeWidget(nodeId, widgetName)
  if (!widget || !node || node.mode !== LGraphEventMode.ALWAYS) return null

  if (!nodeDataByNode.has(node)) {
    nodeDataByNode.set(node, nodeToNodeData(node))
  }
  const fullNodeData = nodeDataByNode.get(node)!

  const matchingWidget = fullNodeData.widgets?.find((vueWidget) => {
    if (vueWidget.slotMetadata?.linked) return false

    if (!node.isSubgraphNode()) return vueWidget.name === widget.name

    const storeNodeId = vueWidget.storeNodeId?.split(':')?.[1] ?? ''
    return (
      isPromotedWidgetView(widget) &&
      widget.sourceNodeId == storeNodeId &&
      widget.sourceWidgetName === vueWidget.storeName
    )
  })
  if (!matchingWidget) return null

  matchingWidget.slotMetadata = undefined
  matchingWidget.nodeId = String(node.id)

  return {
    key: `${nodeId}:${widgetName}`,
    nodeData: {
      ...fullNodeData,
      widgets: [matchingWidget]
    },
    action: { widget, node }
  }
}

const mappedSelections = computed((): WidgetEntry[] => {
  void graphNodes.value
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof nodeToNodeData>
  >()

  if (itemKeys) {
    const results: WidgetEntry[] = []
    for (const key of itemKeys) {
      if (!key.startsWith('input:')) continue
      const parts = key.split(':')
      const nodeId = parts[1]
      const widgetName = parts.slice(2).join(':')
      const entry = resolveInputEntry(nodeId, widgetName, nodeDataByNode)
      if (entry) results.push(entry)
    }
    return results
  }

  const inputs = zoneId
    ? appModeStore.selectedInputs.filter(
        ([nId, wName]) => appModeStore.getZone(nId, wName) === zoneId
      )
    : appModeStore.selectedInputs

  return inputs
    .filter(
      ([nodeId, widgetName]) =>
        !groupedItemKeys.value.has(`input:${nodeId}:${widgetName}`)
    )
    .flatMap(([nodeId, widgetName]) => {
      const entry = resolveInputEntry(nodeId, widgetName, nodeDataByNode)
      return entry ? [entry] : []
    })
})

function getDropIndicator(node: LGraphNode) {
  return buildDropIndicator(node, {
    imageLabel: mobile ? undefined : t('linearMode.dragAndDropImage'),
    videoLabel: mobile ? undefined : t('linearMode.dragAndDropVideo'),
    openMaskEditor: maskEditor.openMaskEditor
  })
}

function nodeToNodeData(node: LGraphNode) {
  const dropIndicator = getDropIndicator(node)
  const nodeData = extractVueNodeData(node)

  return {
    ...nodeData,
    hasErrors: !!executionErrorStore.lastNodeErrors?.[node.id],
    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}
</script>
<template>
  <div
    v-for="{ key, nodeData, action } in mappedSelections"
    :key
    :class="
      cn(
        builderMode &&
          'draggable-item drag-handle pointer-events-auto relative cursor-grab [&.is-draggable]:cursor-grabbing'
      )
    "
    :aria-label="
      builderMode
        ? `${action.widget.label ?? action.widget.name} — ${action.node.title}`
        : undefined
    "
  >
    <div
      :class="
        cn(
          'flex min-h-8 items-center gap-1 px-3 pt-1.5',
          builderMode && 'drag-handle'
        )
      "
    >
      <span
        v-tooltip.top="action.widget.label || action.widget.name"
        :class="cn('truncate text-sm/8', builderMode && 'pointer-events-none')"
      >
        {{ action.widget.label || action.widget.name }}
      </span>
      <span
        v-if="builderMode"
        class="pointer-events-none mx-1 min-w-10 flex-1 truncate text-right text-xs text-muted-foreground"
      >
        {{ action.node.title }}
      </span>
      <div v-else class="flex-1" />
    </div>
    <div
      :class="builderMode && 'pointer-events-none'"
      :inert="builderMode || undefined"
    >
      <DropZone
        :on-drag-over="nodeData.onDragOver"
        :on-drag-drop="nodeData.onDragDrop"
        :drop-indicator="nodeData.dropIndicator"
        class="text-muted-foreground"
      >
        <NodeWidgets
          :node-data
          :class="
            cn(
              'gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10',
              nodeData.hasErrors && 'ring-2 ring-node-stroke-error ring-inset'
            )
          "
        />
      </DropZone>
    </div>
    <div
      v-if="!builderMode"
      :class="
        cn(
          'mx-3 border-b border-border-subtle/30',
          key === mappedSelections.at(-1)?.key && 'hidden'
        )
      "
    />
  </div>
</template>
