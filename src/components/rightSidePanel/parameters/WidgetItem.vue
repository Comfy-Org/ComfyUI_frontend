<script setup lang="ts">
import { computed, shallowRef, triggerRef, watchEffect } from 'vue'

import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import type { WidgetUpdateType } from '../shared'
import WidgetActions from './WidgetActions.vue'

const {
  widget: theWidget,
  node,
  isDraggable = false,
  hiddenFavoriteIndicator = false,
  showNodeName = false,
  parents = [],
  isShownOnParents = false
} = defineProps<{
  widget: IBaseWidget
  node: LGraphNode
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
  showNodeName?: boolean
  parents?: SubgraphNode[]
  isShownOnParents?: boolean
}>()

const widget = shallowRef(theWidget)
watchEffect(() => (widget.value = theWidget))

const emit = defineEmits<{
  valueChange: [widget: IBaseWidget, value: string | number | boolean | object]
  widgetUpdate: [event: WidgetUpdateType]
}>()

const favoritedWidgetsStore = useFavoritedWidgetsStore()

const widgetComponent = computed(() => {
  const component = getComponent(widget.value.type, widget.value.name)
  return component || WidgetLegacy
})

const sourceNodeName = computed((): string | null => {
  let sourceNode: LGraphNode | null = node
  if (isProxyWidget(widget.value)) {
    const { graph, nodeId } = widget.value._overlay
    sourceNode = getNodeByExecutionId(graph, nodeId)
  }
  return sourceNode ? sourceNode.title || sourceNode.type : null
})

const hasParents = computed(() => parents?.length > 0)
const favoriteNode = computed(() =>
  isShownOnParents && hasParents.value ? parents[0] : node
)

function handleValueChange(value: string | number | boolean | object) {
  emit('valueChange', widget.value, value)
}

function handleWidgetUpdate(event: WidgetUpdateType) {
  triggerRef(widget)
  emit('widgetUpdate', event)
}
</script>

<template>
  <div
    :class="
      cn(
        'widget-item col-span-full grid grid-cols-subgrid rounded-lg group',
        isDraggable &&
          'draggable-item drag-handle cursor-grab bg-comfy-menu-bg [&.is-draggable]:cursor-grabbing outline-comfy-menu-bg [&.is-draggable]:outline-4 [&.is-draggable]:outline-offset-0 [&.is-draggable]:opacity-70'
      )
    "
  >
    <!-- widget header -->
    <div
      :class="
        cn(
          'min-h-8 flex items-center justify-between gap-1 mb-1.5 min-w-0',
          isDraggable && 'pointer-events-none'
        )
      "
    >
      <span
        v-if="widget.name"
        :class="
          cn(
            'text-sm leading-8 p-0 m-0 truncate',
            isDraggable && 'pointer-events-none'
          )
        "
      >
        {{ widget.label || widget.name }}
      </span>

      <span
        v-if="(showNodeName || hasParents) && sourceNodeName"
        class="text-xs text-muted-foreground flex-1 p-0 my-0 mx-1 truncate text-right min-w-10"
      >
        {{ sourceNodeName }}
      </span>
      <div class="flex items-center gap-1 shrink-0 pointer-events-auto">
        <WidgetActions
          :widget="widget"
          :node="node"
          :parents="parents"
          :is-shown-on-parents="isShownOnParents"
          @widget-update="handleWidgetUpdate"
        />
      </div>
    </div>
    <!-- favorite indicator -->
    <div
      v-if="
        !hiddenFavoriteIndicator &&
        favoritedWidgetsStore.isFavorited(favoriteNode, widget.name)
      "
      class="relative z-2 pointer-events-none"
    >
      <i
        class="absolute -right-1 -top-1 pi pi-star-fill text-xs text-muted-foreground pointer-events-none"
      />
    </div>
    <!-- widget content -->
    <component
      :is="widgetComponent"
      :widget="widget"
      :model-value="widget.value"
      :node-id="String(node.id)"
      :node-type="node.type"
      :class="cn('col-span-1', shouldExpand(widget.type) && 'min-h-36')"
      @update:model-value="handleValueChange"
    />
    <!-- Drag handle -->
    <div
      :class="
        cn(
          'pointer-events-none mt-1.5 mx-auto max-w-40 w-1/2 h-1 rounded-lg bg-transparent transition-colors duration-150',
          'group-hover:bg-interface-stroke group-[.is-draggable]:bg-component-node-widget-background-highlighted',
          !isDraggable && '!opacity-0'
        )
      "
    />
  </div>
</template>
