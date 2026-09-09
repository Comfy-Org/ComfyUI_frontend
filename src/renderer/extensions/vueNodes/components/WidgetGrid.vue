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
    <template v-for="row in renderedRows" :key="row.widget.renderKey">
      <div
        :data-testid="row.testId"
        :class="
          cn(
            'group col-span-full grid grid-cols-subgrid items-stretch',
            row.showsControl && 'lg-node-widget'
          )
        "
      >
        <div
          :class="
            cn(
              'z-10 flex w-3 items-stretch opacity-0 transition-opacity duration-150 group-hover:opacity-100',
              row.widget.slotMetadata?.linked && 'opacity-100'
            )
          "
        >
          <InputSlot
            v-if="row.widget.slotMetadata"
            :key="`widget-slot-${row.widget.simplified.name}-${row.widget.slotMetadata.index}`"
            :slot-data="{
              name: row.widget.simplified.name,
              type: row.widget.slotMetadata.type,
              boundingRect: [0, 0, 0, 0]
            }"
            :node-id
            :has-error="row.widget.hasError"
            :index="row.widget.slotMetadata.index"
            :socketless="row.widget.simplified.spec?.socketless"
            :standalone="row.standalone"
            dot-only
          />
        </div>
        <AppInput
          v-if="row.showsControl"
          :widget-id="row.widget.widgetId"
          :name="row.widget.simplified.name"
          :enable="canSelectInputs && !row.widget.simplified.options?.disabled"
        >
          <component
            :is="row.widget.vueComponent"
            v-tooltip.left="row.widget.tooltipConfig ?? EMPTY_TOOLTIP"
            :model-value="row.widget.simplified.value"
            :widget="row.widget.simplified"
            :node-id
            :node-type
            :invalid="row.widget.hasError"
            :aria-invalid="row.widget.hasError || undefined"
            :class="
              cn(
                'col-span-2',
                row.widget.hasError && 'font-bold text-node-stroke-error'
              )
            "
            @update:model-value="row.widget.updateHandler"
            @contextmenu="row.widget.handleContextMenu"
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

import InputSlot from './InputSlot.vue'

const EMPTY_TOOLTIP: TooltipOptions = {}
const grid = useTemplateRef<HTMLElement>('grid')

const isConvertedWidgetType = (type: string) =>
  type === 'converted-widget' || type.startsWith('converted-widget:')

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
const renderedRows = computed(() =>
  processedWidgets.flatMap((widget) => {
    const isConverted = isConvertedWidgetType(widget.simplified.type)
    const showsControl = !isConverted && widget.visible
    const shouldRender = isConverted
      ? !!widget.slotMetadata
      : widget.visible ||
        (!!widget.suppressedByConnection && !!widget.slotMetadata)
    if (!shouldRender) return []

    return [
      {
        widget,
        showsControl,
        standalone: !showsControl && !!widget.suppressedByConnection,
        testId: showsControl ? 'node-widget' : undefined,
        rowSize:
          showsControl &&
          (shouldExpand(widget.simplified.type) || widget.hasLayoutSize)
            ? 'auto'
            : 'min-content'
      }
    ]
  })
)

const gridTemplateRows = computed(() =>
  renderedRows.value.map((row) => row.rowSize).join(' ')
)

const layoutKey = computed(() =>
  renderedRows.value
    .map(
      ({ widget }) => `${widget.renderKey}:${widget.slotMetadata?.index ?? ''}`
    )
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
