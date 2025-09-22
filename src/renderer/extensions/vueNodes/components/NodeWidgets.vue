<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets flex flex-col gap-2 pr-4',
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    @pointerdown.stop="handleWidgetPointerEvent"
    @pointermove.stop="handleWidgetPointerEvent"
    @pointerup.stop="handleWidgetPointerEvent"
  >
    <div
      v-for="(widget, index) in processedWidgets"
      :key="`widget-${index}-${widget.name}`"
      class="lg-widget-container relative flex items-center group"
    >
      <!-- Widget Input Slot Dot -->
      <div
        class="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        <InputSlot
          :slot-data="{
            name: widget.name,
            type: widget.type,
            boundingRect: [0, 0, 0, 0]
          }"
          :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
          :index="getWidgetInputIndex(widget)"
          :readonly="readonly"
          :dot-only="true"
        />
      </div>
      <!-- Widget Component -->
      <component
        :is="widget.vueComponent"
        v-tooltip.left="widget.tooltipConfig"
        :widget="widget.simplified"
        :model-value="widget.value"
        :readonly="readonly"
        class="flex-1"
        @update:model-value="widget.updateHandler"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, inject, onErrorCaptured, ref } from 'vue'

import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'
// Import widget components directly
import WidgetInputText from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue'
import {
  getComponent,
  isEssential,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  nodeData?: VueNodeData
  readonly?: boolean
  lodLevel?: LODLevel
}

const { nodeData, readonly, lodLevel } = defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, forwardEventToCanvas } =
  useCanvasInteractions()
const handleWidgetPointerEvent = (event: PointerEvent) => {
  if (!shouldHandleNodePointerEvents.value) {
    forwardEventToCanvas(event)
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
const tooltipContainer =
  inject<Ref<HTMLElement | undefined>>('tooltipContainer')
const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType.value,
  tooltipContainer
)

interface ProcessedWidget {
  name: string
  type: string
  vueComponent: any
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: unknown) => void
  tooltipConfig: any
}

const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []

  const widgets = nodeData.widgets as SafeWidgetData[]
  const result: ProcessedWidget[] = []

  if (lodLevel === LODLevel.MINIMAL) {
    return []
  }

  for (const widget of widgets) {
    if (widget.options?.hidden) continue
    if (widget.options?.canvasOnly) continue
    if (!widget.type) continue
    if (!shouldRenderAsVue(widget)) continue

    if (lodLevel === LODLevel.REDUCED && !isEssential(widget.type)) continue

    const vueComponent = getComponent(widget.type) || WidgetInputText

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value: widget.value,
      options: widget.options,
      callback: widget.callback
    }

    const updateHandler = (value: unknown) => {
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
      tooltipConfig
    })
  }

  return result
})

// TODO: Refactor to avoid O(n) lookup - consider storing input index on widget creation
// or restructuring data model to unify widgets and inputs
// Map a widget to its corresponding input slot index
const getWidgetInputIndex = (widget: ProcessedWidget): number => {
  const inputs = nodeData?.inputs
  if (!inputs) return 0

  const idx = inputs.findIndex((input: any) => {
    if (!input || typeof input !== 'object') return false
    if (!('name' in input && 'type' in input)) return false
    return 'widget' in input && input.widget?.name === widget.name
  })
  return idx >= 0 ? idx : 0
}
</script>
