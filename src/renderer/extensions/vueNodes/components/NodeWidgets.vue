<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    data-testid="node-widgets"
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-y-1',
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
        v-if="widget.visible"
        data-testid="node-widget"
        :class="
          cn(
            'lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch pr-3',
            widget.linkedDisplay === 'placeholder' && 'relative'
          )
        "
        @contextmenu="widget.linkedDisplay && widget.handleContextMenu($event)"
      >
        <!-- Widget Input Slot Dot -->
        <div
          :class="
            cn(
              'z-10 flex items-stretch transition-opacity duration-150',
              widget.linkedDisplay === 'slot'
                ? 'col-span-2 w-auto opacity-100'
                : 'w-3 opacity-0 group-hover:opacity-100',
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
            :node-id="nodeData?.id"
            :has-error="widget.hasError"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            :dot-only="widget.linkedDisplay !== 'slot'"
          />
        </div>
        <!-- Widget Component -->
        <AppInput
          v-if="widget.linkedDisplay !== 'slot'"
          :widget-id="widget.widgetId"
          :name="widget.name"
          :enable="canSelectInputs && !widget.simplified.options?.disabled"
        >
          <component
            :is="widget.vueComponent"
            v-model="widget.value"
            v-tooltip.left="widget.tooltipConfig"
            :widget="widget.simplified"
            :node-id="nodeData?.id"
            :node-type="nodeType"
            :inert="widget.linkedDisplay === 'placeholder' ? true : undefined"
            :aria-hidden="
              widget.linkedDisplay === 'placeholder' ? 'true' : undefined
            "
            :data-testid="
              widget.linkedDisplay === 'placeholder'
                ? 'linked-widget-placeholder'
                : undefined
            "
            :class="
              cn(
                'col-span-2',
                widget.linkedDisplay === 'placeholder' &&
                  LINKED_WIDGET_DISPLAY_CLASS,
                widget.hasError && 'font-bold text-node-stroke-error'
              )
            "
            @update:model-value="widget.updateHandler"
            @contextmenu="widget.handleContextMenu"
          />
          <i
            v-if="widget.linkedDisplay === 'placeholder'"
            data-testid="linked-widget-indicator"
            aria-hidden="true"
            class="pointer-events-none absolute z-10 col-start-3 row-start-1 ml-2 icon-[lucide--link] size-4 self-center justify-self-start text-component-node-foreground-secondary opacity-40"
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
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  nodeData?: VueNodeData
}

const LINKED_WIDGET_DISPLAY_CLASS = cn(
  'pointer-events-none',
  '[&_.widget-input-base]:relative',
  '[&_.widget-input-base]:bg-component-node-widget-background/40',
  '[&_.widget-input-base]:text-transparent',
  '[&_.widget-input-base]:opacity-100',
  '[&_.widget-input-base]:ring-0',
  '[&_.widget-input-base>*]:invisible'
)

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
    bringNodeToFront(nodeData.id)
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

const { canSelectInputs, gridTemplateRows, nodeType, processedWidgets } =
  useProcessedWidgets(() => nodeData)

// Tracks widget-row growth that the node-level RO can't see
if (nodeData?.id != null) {
  useVueElementTracking(nodeData.id, 'widgets-grid')
}
</script>
