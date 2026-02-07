<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,max-content)_minmax(125px,auto)] gap-y-1 pr-3',
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="{
      'grid-template-rows': gridTemplateRows,
      flex: gridTemplateRows.includes('auto') ? 1 : undefined
    }"
    @pointerdown.capture="handleBringToFront"
    @pointerdown="handleWidgetPointerEvent"
    @pointermove="handleWidgetPointerEvent"
    @pointerup="handleWidgetPointerEvent"
  >
    <template
      v-for="(widget, index) in processedWidgets"
      :key="`widget-${index}-${widget.name}`"
    >
      <div
        v-if="!widget.hidden && (!widget.advanced || showAdvanced)"
        class="lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch"
        :data-widget-name="widget.name"
      >
        <!-- Widget Input Slot Dot -->
        <div
          :class="
            cn(
              'z-10 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 flex items-stretch',
              widget.slotMetadata?.linked && 'opacity-100'
            )
          "
        >
          <InputSlot
            v-if="widget.slotMetadata"
            :slot-data="{
              name: widget.name,
              type: widget.type,
              boundingRect: [0, 0, 0, 0]
            }"
            :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <!-- Widget Component -->
        <component
          :is="widget.vueComponent"
          v-model="widget.value"
          v-tooltip.left="widget.tooltipConfig"
          :widget="widget.simplified"
          :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
          :node-type="nodeType"
          class="col-span-2"
          @update:model-value="widget.updateHandler"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TooltipOptions } from 'primevue'
import { computed, onErrorCaptured, ref, toValue } from 'vue'
import type { Component } from 'vue'

import type {
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
// Import widget components directly
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  nodeData?: VueNodeData
}

const { nodeData } = defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, forwardEventToCanvas } =
  useCanvasInteractions()
const { bringNodeToFront } = useNodeZIndex()

function handleWidgetPointerEvent(event: PointerEvent) {
  if (shouldHandleNodePointerEvents.value) return
  event.stopPropagation()
  forwardEventToCanvas(event)
}

function handleBringToFront() {
  if (nodeData?.id != null) {
    bringNodeToFront(String(nodeData.id))
  }
}

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const nodeType = computed(() => nodeData?.type || '')
const settingStore = useSettingStore()
const showAdvanced = computed(
  () =>
    nodeData?.showAdvanced ||
    settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
)
const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType.value
)
const widgetValueStore = useWidgetValueStore()

interface ProcessedWidget {
  name: string
  type: string
  vueComponent: Component
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: WidgetValue) => void
  tooltipConfig: TooltipOptions
  slotMetadata?: WidgetSlotMetadata
  /** Whether widget is hidden (from widgetValueStore) */
  hidden: boolean
  /** Whether widget is advanced (from widgetValueStore) */
  advanced: boolean
  /** Whether widget has custom layout size computation */
  hasLayoutSize: boolean
}

const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []

  const nodeId = nodeData.id
  const { widgets } = nodeData
  const result: ProcessedWidget[] = []

  for (const widget of widgets) {
    if (!shouldRenderAsVue(widget)) continue

    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata } = widget

    // Get metadata from store (registered during BaseWidget.setNodeId)
    const bareWidgetId = stripGraphPrefix(widget.nodeId ?? nodeId)
    const widgetState = widgetValueStore.getWidget(bareWidgetId, widget.name)

    // Get value from store (falls back to undefined if not registered)
    const value = widgetState?.value as WidgetValue

    // Build options from store state, with slot-linked override for disabled
    const storeOptions = widgetState?.options ?? {}
    const widgetOptions = slotMetadata?.linked
      ? { ...storeOptions, disabled: true }
      : storeOptions

    // Derive border style from store metadata
    const borderStyle =
      widgetState?.promoted && String(widgetState?.nodeId) === String(nodeId)
        ? 'ring ring-component-node-widget-promoted'
        : widgetState?.advanced
          ? 'ring ring-component-node-widget-advanced'
          : undefined

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value,
      borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widgetState?.label,
      nodeType: widget.nodeType,
      options: widgetOptions,
      spec: widget.spec
    }

    function updateHandler(newValue: WidgetValue) {
      // Update value in store
      if (widgetState) widgetState.value = newValue
      // Invoke LiteGraph callback wrapper (handles triggerDraw, etc.)
      widget.callback?.(newValue)
    }

    const tooltipText = getWidgetTooltip(widget)
    const tooltipConfig = createTooltipConfig(tooltipText)

    result.push({
      name: widget.name,
      type: widget.type,
      vueComponent,
      simplified,
      value,
      updateHandler,
      tooltipConfig,
      slotMetadata,
      hidden: widgetState?.hidden ?? false,
      advanced: widgetState?.advanced ?? false,
      hasLayoutSize: widget.hasLayoutSize ?? false
    })
  }

  return result
})

const gridTemplateRows = computed((): string => {
  // Use processedWidgets directly since it already has store-based hidden/advanced
  return toValue(processedWidgets)
    .filter((w) => !w.hidden && (!w.advanced || showAdvanced.value))
    .map((w) =>
      shouldExpand(w.type) || w.hasLayoutSize ? 'auto' : 'min-content'
    )
    .join(' ')
})
</script>
