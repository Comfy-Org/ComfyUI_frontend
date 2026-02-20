<template>
  <div
    ref="grid"
    data-testid="node-widgets"
    class="lg-node-widgets grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-y-1 pr-3"
    :style="{
      'grid-template-rows': gridTemplateRows,
      flex: gridTemplateRows.includes('auto') ? 1 : undefined
    }"
  >
    <template v-for="widget in processedWidgets" :key="widget.renderKey">
      <div
        v-if="shouldRenderRow(widget)"
        :data-testid="isConvertedWidget(widget) ? undefined : 'node-widget'"
        :class="
          cn(
            'group col-span-full grid grid-cols-subgrid items-stretch',
            !isConvertedWidget(widget) && 'lg-node-widget',
            isDragHoverTarget(widget) &&
              'ring ring-component-node-widget-linked',
            !isDragHoverTarget(widget) &&
              widget.slotMetadata?.linked &&
              'border-l-2 border-component-node-widget-linked'
          )
        "
      >
        <div
          data-testid="widget-slot-container"
          :class="
            cn(
              'z-10 flex w-3 items-stretch transition-opacity duration-150',
              dragState.active || widget.slotMetadata?.linked
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            )
          "
        >
          <InputSlot
            v-if="widget.slotMetadata"
            :key="`widget-slot-${widget.simplified.name}-${widget.slotMetadata.index}`"
            :slot-data="{
              name: widget.simplified.name,
              type: widget.slotMetadata.type,
              boundingRect: [0, 0, 0, 0]
            }"
            :node-id
            :has-error="widget.hasError"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <AppInput
          v-if="!isConvertedWidget(widget)"
          :widget-id="widget.widgetId"
          :name="widget.simplified.name"
          :enable="canSelectInputs && !widget.simplified.options?.disabled"
        >
          <component
            :is="widget.vueComponent"
            v-tooltip.left="widget.tooltipConfig ?? EMPTY_TOOLTIP"
            :model-value="widget.simplified.value"
            :widget="widget.simplified"
            :node-id
            :node-type
            :invalid="widget.hasError"
            :aria-invalid="widget.hasError || undefined"
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
import type { TooltipOptions } from 'primevue'
import { computed, useTemplateRef, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@/types/nodeId'
import { cn } from '@comfyorg/tailwind-utils'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'

import InputSlot from './InputSlot.vue'

const EMPTY_TOOLTIP: TooltipOptions = {}
const grid = useTemplateRef<HTMLElement>('grid')

const isConvertedWidgetType = (type: string) =>
  type === 'converted-widget' || type.startsWith('converted-widget:')

const isConvertedWidget = (widget: WidgetGridItem) =>
  isConvertedWidgetType(widget.simplified.type)

const shouldRenderRow = (widget: WidgetGridItem) =>
  isConvertedWidget(widget) ? !!widget.slotMetadata : widget.visible

const { state: dragState } = useSlotLinkDragUIState()

const isDragHoverTarget = (widget: WidgetGridItem) => {
  const candidate = dragState.candidate
  return (
    dragState.active &&
    candidate?.compatible === true &&
    candidate.layout.type === 'input' &&
    String(candidate.layout.nodeId) === String(nodeId) &&
    candidate.layout.index === widget.slotMetadata?.index
  )
}

const {
  processedWidgets,
  nodeType,
  canSelectInputs = false,
  nodeId,
  syncLayout = true
} = defineProps<{
  processedWidgets: WidgetGridItem[]
  nodeType: string
  canSelectInputs?: boolean
  nodeId?: NodeId
  syncLayout?: boolean
}>()

useVueElementTracking(syncLayout ? String(nodeId ?? '') : '', 'widgets-grid')
const canvasStore = useCanvasStore()

const gridTemplateRows = computed(() =>
  processedWidgets
    .filter(shouldRenderRow)
    .map((widget) =>
      !isConvertedWidget(widget) &&
      (shouldExpand(widget.simplified.type) || widget.hasLayoutSize)
        ? 'auto'
        : 'min-content'
    )
    .join(' ')
)

const layoutKey = computed(() =>
  processedWidgets
    .filter((widget) => widget.visible)
    .map((widget) => `${widget.renderKey}:${widget.slotMetadata?.index ?? ''}`)
    .join('|')
)

watch(
  layoutKey,
  () => {
    const rootGraphId = canvasStore.rootGraphId
    if (syncLayout && grid.value && rootGraphId && nodeId) {
      syncSlotOffsets(grid.value, rootGraphId, nodeId)
    }
  },
  { flush: 'post' }
)
</script>
