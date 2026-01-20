<script setup lang="ts">
import { computed, customRef, ref } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import { getSharedWidgetEnhancements } from '@/composables/graph/useGraphNodeManager'
import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'
import { renameWidget } from '@/utils/widgetUtil'

import WidgetActions from './WidgetActions.vue'

const {
  widget,
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

const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const isEditing = ref(false)

const widgetComponent = computed(() => {
  const component = getComponent(widget.type, widget.name)
  return component || WidgetLegacy
})

const enhancedWidget = computed(() => {
  // Get shared enhancements (reactive value, controlWidget, spec, nodeType, etc.)
  const enhancements = getSharedWidgetEnhancements(node, widget)
  return { ...widget, ...enhancements }
})

const sourceNodeName = computed((): string | null => {
  let sourceNode: LGraphNode | null = node
  if (isProxyWidget(widget)) {
    const { graph, nodeId } = widget._overlay
    sourceNode = getNodeByExecutionId(graph, nodeId)
  }
  return sourceNode ? sourceNode.title || sourceNode.type : null
})

const hasParents = computed(() => parents?.length > 0)
const favoriteNode = computed(() =>
  isShownOnParents && hasParents.value ? parents[0] : node
)

const widgetValue = computed({
  get: () => {
    widget.vueTrack?.()
    return widget.value
  },
  set: (newValue: string | number | boolean | object) => {
    // eslint-disable-next-line vue/no-mutating-props
    widget.value = newValue
    widget.callback?.(newValue)
    canvasStore.canvas?.setDirty(true, true)
  }
})

const displayLabel = customRef((track, trigger) => {
  return {
    get() {
      track()
      return widget.label || widget.name
    },
    set(newValue: string) {
      isEditing.value = false

      const trimmedLabel = newValue.trim()

      const success = renameWidget(widget, node, trimmedLabel, parents)

      if (success) {
        canvasStore.canvas?.setDirty(true)
        trigger()
      }
    }
  }
})
</script>

<template>
  <div
    :class="
      cn(
        'widget-item group col-span-full grid grid-cols-subgrid rounded-lg',
        isDraggable &&
          'draggable-item drag-handle cursor-grab bg-comfy-menu-bg outline-comfy-menu-bg !will-change-auto [&.is-draggable]:cursor-grabbing [&.is-draggable]:opacity-70 [&.is-draggable]:outline-4 [&.is-draggable]:outline-offset-0'
      )
    "
  >
    <!-- widget header -->
    <div
      :class="
        cn(
          'mb-1.5 flex min-h-8 min-w-0 items-center justify-between gap-1',
          isDraggable && 'pointer-events-none'
        )
      "
    >
      <EditableText
        v-if="widget.name"
        :model-value="displayLabel"
        :is-editing="isEditing"
        :input-attrs="{ placeholder: widget.name }"
        class="pointer-events-auto m-0 cursor-text truncate p-0 text-sm leading-8"
        @edit="displayLabel = $event"
        @cancel="isEditing = false"
        @click="isEditing = true"
      />

      <span
        v-if="(showNodeName || hasParents) && sourceNodeName"
        class="mx-1 my-0 min-w-10 flex-1 truncate p-0 text-right text-xs text-muted-foreground"
      >
        {{ sourceNodeName }}
      </span>
      <div class="pointer-events-auto flex shrink-0 items-center gap-1">
        <WidgetActions
          v-model:label="displayLabel"
          :widget="widget"
          :node="node"
          :parents="parents"
          :is-shown-on-parents="isShownOnParents"
        />
      </div>
    </div>
    <!-- favorite indicator -->
    <div
      v-if="
        !hiddenFavoriteIndicator &&
          favoritedWidgetsStore.isFavorited(favoriteNode, widget.name)
      "
      class="pointer-events-none relative z-2"
    >
      <i
        class="pi pi-star-fill pointer-events-none absolute -top-1 -right-1 text-xs text-muted-foreground"
      />
    </div>
    <!-- widget content -->
    <component
      :is="widgetComponent"
      v-model="widgetValue"
      :widget="enhancedWidget"
      :node-id="String(node.id)"
      :node-type="node.type"
      :class="cn('col-span-1', shouldExpand(widget.type) && 'min-h-36')"
    />
    <!-- Drag handle -->
    <div
      :class="
        cn(
          'pointer-events-none mx-auto mt-1.5 h-1 w-1/2 max-w-40 rounded-lg bg-transparent transition-colors duration-150',
          'group-hover:bg-interface-stroke group-[.is-draggable]:bg-component-node-widget-background-highlighted',
          !isDraggable && 'opacity-0'
        )
      "
    />
  </div>
</template>
