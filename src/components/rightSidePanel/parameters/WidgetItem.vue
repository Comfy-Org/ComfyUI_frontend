<script setup lang="ts">
import { computed, customRef, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import { getSharedWidgetEnhancements } from '@/composables/graph/useGraphNodeManager'
import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import { st } from '@/i18n'
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
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
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

const emit = defineEmits<{
  'update:widgetValue': [value: string | number | boolean | object]
  resetToDefault: [value: string | number | boolean | object | undefined]
}>()

const { t } = useI18n()
const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const isEditing = ref(false)

const widgetComponent = computed(() => {
  const component = getComponent(widget.type)
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
  if (!sourceNode) return null
  const fallbackNodeTitle = t('rightSidePanel.fallbackNodeTitle')
  return resolveNodeDisplayName(sourceNode, {
    emptyLabel: fallbackNodeTitle,
    untitledLabel: fallbackNodeTitle,
    st
  })
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
    emit('update:widgetValue', newValue)
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
        'widget-item col-span-full grid grid-cols-subgrid rounded-lg group',
        isDraggable &&
          'draggable-item !will-change-auto drag-handle cursor-grab bg-comfy-menu-bg [&.is-draggable]:cursor-grabbing outline-comfy-menu-bg [&.is-draggable]:outline-4 [&.is-draggable]:outline-offset-0 [&.is-draggable]:opacity-70'
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
      <EditableText
        v-if="widget.name"
        :model-value="displayLabel"
        :is-editing="isEditing"
        :input-attrs="{ placeholder: widget.name }"
        class="text-sm leading-8 p-0 m-0 truncate pointer-events-auto cursor-text"
        @edit="displayLabel = $event"
        @cancel="isEditing = false"
        @click="isEditing = true"
      />

      <span
        v-if="(showNodeName || hasParents) && sourceNodeName"
        class="text-xs text-muted-foreground flex-1 p-0 my-0 mx-1 truncate text-right min-w-10"
      >
        {{ sourceNodeName }}
      </span>
      <div class="flex items-center gap-1 shrink-0 pointer-events-auto">
        <WidgetActions
          v-model:label="displayLabel"
          :widget="widget"
          :node="node"
          :parents="parents"
          :is-shown-on-parents="isShownOnParents"
          @reset-to-default="emit('resetToDefault', $event)"
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
          'pointer-events-none mt-1.5 mx-auto max-w-40 w-1/2 h-1 rounded-lg bg-transparent transition-colors duration-150',
          'group-hover:bg-interface-stroke group-[.is-draggable]:bg-component-node-widget-background-highlighted',
          !isDraggable && 'opacity-0'
        )
      "
    />
  </div>
</template>
