<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ $t('Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets flex flex-col has-[.widget-expands]:flex-1 gap-2 pr-3',
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    @pointerdown="handleWidgetPointerEvent"
    @pointermove="handleWidgetPointerEvent"
    @pointerup="handleWidgetPointerEvent"
  >
    <div
      v-for="(widget, index) in processedWidgets"
      :key="`widget-${index}-${widget.name}`"
      class="group flex items-stretch has-[.widget-expands]:flex-1"
    >
      <!-- Widget Input Slot Dot -->

      <div
        :class="
          cn(
            'z-10 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 flex items-center',
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
        class="flex-1"
        @update:model-value="widget.updateHandler"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type {
  SafeWidgetData,
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
// Import widget components directly
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
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
function handleWidgetPointerEvent(event: PointerEvent) {
  if (shouldHandleNodePointerEvents.value) return
  event.stopPropagation()
  forwardEventToCanvas(event)
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
  vueComponent: any
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: unknown) => void
  tooltipConfig: any
  slotMetadata?: WidgetSlotMetadata
}

const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []

  const widgets = nodeData.widgets as SafeWidgetData[]
  const result: ProcessedWidget[] = []

  for (const widget of widgets) {
    // Skip if widget is in the hidden list for this node type
    if (widget.options?.hidden) continue
    if (widget.options?.canvasOnly) continue
    if (!widget.type) continue
    if (!shouldRenderAsVue(widget)) continue

    const vueComponent =
      getComponent(widget.type, widget.name) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const slotMetadata = widget.slotMetadata

    let widgetOptions = widget.options
    // Core feature: Disable Vue widgets when their input slots are connected
    // This prevents conflicting input sources - when a slot is linked to another
    // node's output, the widget should be read-only to avoid data conflicts
    if (slotMetadata?.linked) {
      widgetOptions = { ...widget.options, disabled: true }
    }

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value: widget.value,
      label: widget.label,
      options: widgetOptions,
      callback: widget.callback,
      spec: widget.spec
    }

    const updateHandler = (value: unknown) => {
      // Update the widget value directly
      widget.value = value as WidgetValue

      if (widget.callback) {
        widget.callback(value)
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
</script>
