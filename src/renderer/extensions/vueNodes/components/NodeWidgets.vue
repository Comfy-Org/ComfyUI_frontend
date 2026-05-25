<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    data-testid="node-widgets"
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-y-1 pr-3',
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
    <template v-for="widget in processedWidgets" :key="widget.renderKey">
      <div
        v-if="!widget.hidden && (!widget.advanced || showAdvanced)"
        data-testid="node-widget"
        :class="
          cn(
            'lg-node-widget group relative col-span-full grid grid-cols-subgrid',
            widget.hasGridOverride ? 'items-center' : 'items-stretch'
          )
        "
      >
        <div
          class="absolute inset-x-0 bottom-0 h-1 cursor-ns-resize opacity-0 transition-opacity hover:bg-node-stroke hover:opacity-50"
          @pointerdown="
            handleResizePointerDown($event, widget.slotName ?? widget.name)
          "
        />
        <!-- Widget Input Slot Dot -->
        <div
          :class="
            cn(
              'z-10 flex w-3 items-stretch opacity-0 transition-opacity duration-150 group-hover:opacity-100',
              widget.slotMetadata?.linked && 'opacity-100'
            )
          "
        >
          <InputSlot
            v-if="widget.slotMetadata"
            :key="`widget-slot-${widget.name}-${widget.slotMetadata.index}`"
            :slot-data="{
              name: widget.name,
              type: widget.slotMetadata.type,
              boundingRect: [0, 0, 0, 0]
            }"
            :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
            :has-error="widget.hasError"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <!-- Widget Component -->
        <AppInput
          :id="widget.id"
          :name="widget.name"
          :enable="canSelectInputs && !widget.simplified.options?.disabled"
        >
          <component
            :is="widget.vueComponent"
            v-model="widget.value"
            v-tooltip.left="widget.tooltipConfig"
            :widget="widget.simplified"
            :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
            :node-type="nodeType"
            :class="
              cn(
                'col-span-2',
                widget.hasError && 'font-bold text-node-stroke-error'
              )
            "
            @update:model-value="widget.updateHandler"
            @contextmenu="widget.handleContextMenu"
          />
        </AppInput>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useWidgetRowResize } from '@/renderer/extensions/vueNodes/composables/useWidgetRowResize'
import { cn } from '@comfyorg/tailwind-utils'

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

const {
  canSelectInputs,
  gridTemplateRows,
  nodeType,
  processedWidgets,
  showAdvanced
} = useProcessedWidgets(() => nodeData)

// Tracks widget-row growth that the node-level RO can't see
if (nodeData?.id != null) {
  useVueElementTracking(String(nodeData.id), 'widgets-grid')
}

const { startResize } = useWidgetRowResize()

function handleResizePointerDown(
  event: PointerEvent,
  widgetOverrideKey: string
) {
  const handle = event.currentTarget as HTMLElement
  const rowElement = handle.closest(
    "[data-testid='node-widget']"
  ) as HTMLElement
  if (!rowElement || nodeData?.id == null) return
  startResize(event, String(nodeData.id), widgetOverrideKey, rowElement)
}
</script>
