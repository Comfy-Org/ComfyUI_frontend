<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, customRef, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { getControlWidget } from '@/types/simplifiedWidget'
import type {
  SimplifiedWidget,
  WidgetValue as SimplifiedWidgetValue
} from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { renameWidget } from '@/utils/widgetUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

import EnhancePromptButton from '@/workbench/extensions/agent/components/EnhancePromptButton.vue'
import {
  EnhancePromptStateKey,
  useEnhancePrompt
} from '@/workbench/extensions/agent/composables/useEnhancePrompt'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { canEnhancePromptOnNode } from '@/workbench/extensions/agent/utils/canEnhancePromptOnNode'

import WidgetActions from './WidgetActions.vue'

function isPromptTextareaWidget(type: string): boolean {
  const canonical = type.toLowerCase()
  return (
    canonical === 'textarea' ||
    canonical === 'multiline' ||
    canonical === 'customtext'
  )
}

const {
  widget,
  node,
  isDraggable = false,
  hiddenFavoriteIndicator = false,
  hiddenWidgetActions = false,
  showNodeName = false,
  parents = [],
  isShownOnParents = false
} = defineProps<{
  widget: IBaseWidget
  node: LGraphNode
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
  hiddenWidgetActions?: boolean
  showNodeName?: boolean
  parents?: SubgraphNode[]
  isShownOnParents?: boolean
}>()

const emit = defineEmits<{
  'update:widgetValue': [value: WidgetValue]
  resetToDefault: [value: WidgetValue]
}>()

const { t } = useI18n()

const canvasStore = useCanvasStore()
const nodeDefStore = useNodeDefStore()
const widgetValueStore = useWidgetValueStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const linkStore = useLinkStore()
const agentPanelStore = useAgentPanelStore()
const { enabled: agentEnabled } = storeToRefs(agentPanelStore)
const isEditing = ref(false)

const widgetComponent = computed(() => {
  const component = getComponent(widget.type)
  return component || WidgetLegacy
})

const isLinked = computed(() => {
  const graph = node.graph
  const slot = node.inputs?.findIndex((i) => i.widget?.name === widget.name)
  if (!graph || slot === undefined || slot < 0) return false
  return linkStore.isInputSlotConnected(graphScopeOf(graph), node.id, slot)
})

const simplifiedWidget = computed((): SimplifiedWidget => {
  const graphId = node.graph?.rootGraph.id
  const bareNodeId = stripGraphPrefix(node.id)
  const widgetState = widget.widgetId
    ? useWidgetValueStore().getWidget(widget.widgetId)
    : graphId && bareNodeId
      ? widgetValueStore.getWidget(widgetId(graphId, bareNodeId, widget.name))
      : undefined
  const widgetName = widgetState?.name ?? widget.name
  const widgetType = widgetState?.type ?? widget.type

  const baseOptions = widgetState?.options ?? widget.options
  const disabled = isLinked.value || !!widget.disabled || undefined
  return {
    name: widgetName,
    type: widgetType,
    value: (widgetState
      ? widgetState.value
      : widget.value) as SimplifiedWidgetValue,
    label: widgetState?.label ?? widget.label,
    options: { ...baseOptions, disabled },
    callback:
      widgetType.toLowerCase() === 'button'
        ? (value) =>
            widget.callback?.(value, canvasStore.canvas ?? undefined, node)
        : undefined,
    spec: nodeDefStore.getInputSpecForWidget(node, widgetName),
    controlWidget: getControlWidget(widget)
  }
})

const displayNodeName = computed((): string | null => {
  if (!node) return null
  const fallbackNodeTitle = t('rightSidePanel.fallbackNodeTitle')
  return resolveNodeDisplayName(node, {
    emptyLabel: fallbackNodeTitle,
    untitledLabel: fallbackNodeTitle
  })
})

const hasParents = computed(() => parents.length > 0)
const favoriteNode = computed(() =>
  isShownOnParents && hasParents.value ? parents[0] : node
)

const widgetValue = computed({
  get: () => widget.value,
  set: (newValue: WidgetValue) => {
    emit('update:widgetValue', newValue)
  }
})

const promptValue = computed({
  get: () => (typeof widgetValue.value === 'string' ? widgetValue.value : ''),
  set: (value: string) => {
    widgetValue.value = value
  }
})

const enhanceWidgetId = computed((): WidgetId | undefined => {
  if (widget.widgetId) return widget.widgetId
  const graphId = node.graph?.rootGraph.id
  const bareNodeId = stripGraphPrefix(node.id)
  if (!graphId || !bareNodeId) return undefined
  return widgetId(graphId, bareNodeId, widget.name)
})

const {
  isLocked,
  isProcessing,
  isRevealing,
  revealText,
  revealStaggerMs,
  enhance
} = useEnhancePrompt({
  prompt: promptValue,
  widgetId: enhanceWidgetId.value
})

const showEnhance = computed(() => {
  if (
    !agentEnabled.value ||
    !isPromptTextareaWidget(simplifiedWidget.value.type)
  )
    return false
  if (
    isLinked.value ||
    widget.disabled ||
    widget.options?.read_only ||
    widget.options?.disabled
  ) {
    return false
  }
  return canEnhancePromptOnNode({
    nodeType: node.type,
    isApiNode: nodeDefStore.getNodeDefByName(node.type)?.api_node === true
  })
})

provide(EnhancePromptStateKey, {
  isLocked,
  isProcessing,
  isRevealing,
  revealText,
  revealStaggerMs
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

      const success = renameWidget(widget, node, trimmedLabel)

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
          'draggable-item drag-handle cursor-grab bg-background outline-background will-change-auto! [&.is-draggable]:cursor-grabbing [&.is-draggable]:opacity-70 [&.is-draggable]:outline-4 [&.is-draggable]:outline-offset-0'
      )
    "
  >
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
        :is-editing
        :input-attrs="{ placeholder: widget.name }"
        class="pointer-events-auto m-0 cursor-text truncate p-0 text-sm/8"
        @edit="displayLabel = $event"
        @cancel="isEditing = false"
        @click="isEditing = true"
      />

      <span
        v-if="(showNodeName || hasParents) && displayNodeName"
        class="mx-1 my-0 min-w-10 flex-1 truncate text-right text-xs text-muted-foreground"
      >
        {{ displayNodeName }}
      </span>
      <div
        v-if="!hiddenWidgetActions"
        class="pointer-events-auto flex shrink-0 items-center gap-1"
      >
        <EnhancePromptButton
          v-if="showEnhance"
          size="icon"
          tooltip-side="bottom"
          :loading="isProcessing"
          :disabled="isLocked"
          @click="enhance"
        />
        <WidgetActions
          v-model:label="displayLabel"
          :widget
          :node
          :parents
          :is-shown-on-parents
          @reset-to-default="emit('resetToDefault', $event)"
        />
      </div>
    </div>
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
    <component
      :is="widgetComponent"
      v-model="widgetValue"
      :widget="simplifiedWidget"
      :widget-id="enhanceWidgetId"
      :hide-enhance="isPromptTextareaWidget(simplifiedWidget.type)"
      :node-id="node.id"
      :node-type="node.type"
      :class="
        cn(
          'col-span-1 text-xs text-node-foreground',
          shouldExpand(widget.type) && 'min-h-36'
        )
      "
    />
    <div
      :class="
        cn(
          'pointer-events-none mx-auto mt-1.5 h-1 w-1/2 max-w-40 rounded-lg bg-transparent transition-colors duration-150',
          'group-hover:bg-border group-[.is-draggable]:bg-muted-foreground',
          !isDraggable && 'opacity-0'
        )
      "
    />
  </div>
</template>
