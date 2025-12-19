<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,max-content)_minmax(125px,auto)] flex-1 gap-y-1 pr-3',
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="{
      'grid-template-rows': gridTemplateRows
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
        v-if="!widget.simplified.options?.hidden"
        class="lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch"
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
          v-tooltip.left="widget.tooltipConfig"
          :widget="widget.simplified"
          :model-value="widget.value"
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
const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType.value
)

interface ProcessedWidget {
  name: string
  type: string
  vueComponent: Component
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: WidgetValue) => void
  tooltipConfig: TooltipOptions
  slotMetadata?: WidgetSlotMetadata
}

const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []

  const { widgets } = nodeData
  const result: ProcessedWidget[] = []

  for (const widget of widgets) {
    if (!shouldRenderAsVue(widget)) continue

    const vueComponent =
      getComponent(widget.type, widget.name) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata, options } = widget

    // Core feature: Disable Vue widgets when their input slots are connected
    // This prevents conflicting input sources - when a slot is linked to another
    // node's output, the widget should be read-only to avoid data conflicts
    const widgetOptions = slotMetadata?.linked
      ? { ...options, disabled: true }
      : options

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value: widget.value,
      borderStyle: widget.borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widget.label,
      nodeType: widget.nodeType,
      options: widgetOptions,
      spec: widget.spec
    }

    function updateHandler(value: WidgetValue) {
      // Update the widget value directly
      widget.value = value

      // Skip callback for asset widgets - their callback opens the modal,
      // but Vue asset mode handles selection through the dropdown
      if (widget.type !== 'asset') {
        widget.callback?.(value)
      }
    }

    const tooltipText = getWidgetTooltip(widget)
    const tooltipConfig = createTooltipConfig(tooltipText)

    result.push({
      name: widget.name,
      type: widget.type,
      vueComponent,
      simplified,
      value: widget.value,
      updateHandler,
      tooltipConfig,
      slotMetadata
    })
  }

  return result
})

const gridTemplateRows = computed((): string => {
  const widgets = toValue(processedWidgets)
  return widgets
    .filter((w) => !w.simplified.options?.hidden)
    .map((w) => (shouldExpand(w.type) ? 'auto' : 'min-content'))
    .join(' ')
})
</script>
