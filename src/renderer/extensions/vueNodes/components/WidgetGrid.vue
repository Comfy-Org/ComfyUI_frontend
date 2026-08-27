<template>
  <div
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
            !isConvertedWidget(widget) && 'lg-node-widget'
          )
        "
      >
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
import { computed } from 'vue'

import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@/types/nodeId'
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'

const EMPTY_TOOLTIP: TooltipOptions = {}

const isConvertedWidgetType = (type: string) =>
  type === 'converted-widget' || type.startsWith('converted-widget:')

const isConvertedWidget = (widget: WidgetGridItem) =>
  isConvertedWidgetType(widget.simplified.type)

const shouldRenderRow = (widget: WidgetGridItem) =>
  widget.visible && (!isConvertedWidget(widget) || !!widget.slotMetadata)

const {
  processedWidgets,
  nodeType,
  canSelectInputs = false,
  nodeId
} = defineProps<{
  processedWidgets: WidgetGridItem[]
  nodeType: string
  canSelectInputs?: boolean
  nodeId?: NodeId
}>()

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
</script>
