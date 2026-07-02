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
        v-if="widget.visible"
        data-testid="node-widget"
        class="lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch"
      >
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
            :node-id="nodeId"
            :has-error="widget.hasError"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <!-- Widget Component -->
        <AppInput
          :widget-id="widget.widgetId"
          :name="widget.name"
          :enable="canSelectInputs && !widget.simplified.options?.disabled"
        >
          <component
            :is="widget.vueComponent"
            v-model="widget.value"
            v-tooltip.left="widget.tooltipConfig ?? EMPTY_TOOLTIP"
            :widget="widget.simplified"
            :node-id="nodeId"
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
import type { TooltipOptions } from 'primevue'
import { computed } from 'vue'
import type { Component } from 'vue'

import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'

/**
 * The fields WidgetGrid renders. The store-backed path passes richer
 * `ProcessedWidget`s (a structural superset); a static preview fills only the
 * required fields and omits the interactive ones.
 */
export interface WidgetGridItem {
  name: string
  type: string
  value: WidgetValue
  simplified: SimplifiedWidget
  vueComponent: Component
  visible: boolean
  renderKey: string
  hasLayoutSize?: boolean
  hasError?: boolean
  widgetId?: WidgetId
  slotMetadata?: { index: number; linked: boolean; type: string }
  tooltipConfig?: TooltipOptions
  updateHandler?: (value: WidgetValue) => void
  handleContextMenu?: (e: PointerEvent) => void
}

const EMPTY_TOOLTIP: TooltipOptions = {}

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
    .filter((widget) => widget.visible)
    .map((widget) =>
      shouldExpand(widget.type) || widget.hasLayoutSize ? 'auto' : 'min-content'
    )
    .join(' ')
)
</script>
