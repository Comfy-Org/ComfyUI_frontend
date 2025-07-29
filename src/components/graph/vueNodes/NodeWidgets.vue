<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Widgets Error
  </div>
  <div v-else class="lg-node-widgets flex flex-col gap-2 pr-4">
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
          :index="index"
          :readonly="readonly"
          :dot-only="true"
          @slot-click="handleWidgetSlotClick($event, widget)"
        />
      </div>
      <!-- Widget Component -->
      <component
        :is="widget.vueComponent"
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
import { computed, onErrorCaptured, onUnmounted, ref } from 'vue'

// Import widget components directly
import WidgetInputText from '@/components/graph/vueWidgets/WidgetInputText.vue'
import { widgetTypeToComponent } from '@/components/graph/vueWidgets/widgetRegistry'
import { useEventForwarding } from '@/composables/graph/useEventForwarding'
import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { LODLevel } from '@/composables/graph/useLOD'
import {
  ESSENTIAL_WIDGET_TYPES,
  useWidgetRenderer
} from '@/composables/graph/useWidgetRenderer'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

import type { LGraphNode } from '../../../lib/litegraph/src/litegraph'
import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  node?: LGraphNode
  nodeData?: VueNodeData
  readonly?: boolean
  lodLevel?: LODLevel
}

const props = defineProps<NodeWidgetsProps>()

// Set up event forwarding for slot interactions
const { handleSlotPointerDown, cleanup } = useEventForwarding()

// Use widget renderer composable
const { getWidgetComponent, shouldRenderAsVue } = useWidgetRenderer()

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const nodeInfo = computed(() => props.nodeData || props.node)

interface ProcessedWidget {
  name: string
  type: string
  vueComponent: any
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: unknown) => void
}

const processedWidgets = computed((): ProcessedWidget[] => {
  const info = nodeInfo.value
  if (!info?.widgets) return []

  const widgets = info.widgets as SafeWidgetData[]
  const lodLevel = props.lodLevel
  const result: ProcessedWidget[] = []

  if (lodLevel === LODLevel.MINIMAL) {
    return []
  }

  for (const widget of widgets) {
    if (widget.options?.hidden) continue
    if (widget.options?.canvasOnly) continue
    if (!widget.type) continue
    if (!shouldRenderAsVue(widget)) continue

    if (
      lodLevel === LODLevel.REDUCED &&
      !ESSENTIAL_WIDGET_TYPES.has(widget.type)
    )
      continue

    const componentName = getWidgetComponent(widget.type)
    const vueComponent = widgetTypeToComponent[componentName] || WidgetInputText

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

    result.push({
      name: widget.name,
      type: widget.type,
      vueComponent,
      simplified,
      value: widget.value,
      updateHandler
    })
  }

  return result
})

// Handle widget slot click
const handleWidgetSlotClick = (
  event: PointerEvent,
  _widget: ProcessedWidget
) => {
  // Forward the event to LiteGraph for native slot handling
  handleSlotPointerDown(event)
}

// Clean up event listeners on unmount
onUnmounted(() => {
  cleanup()
})
</script>
