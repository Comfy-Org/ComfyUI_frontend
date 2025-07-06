<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Widgets Error
  </div>
  <div v-else class="lg-node-widgets flex flex-col gap-2">
    <component
      :is="widget.vueComponent"
      v-for="(widget, index) in processedWidgets"
      :key="`widget-${index}-${widget.name}`"
      :widget="widget.simplified"
      :model-value="widget.value"
      :readonly="readonly"
      @update:model-value="widget.updateHandler"
    />
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

// Import widget components directly
import WidgetInputText from '@/components/graph/vueWidgets/WidgetInputText.vue'
import { widgetTypeToComponent } from '@/components/graph/vueWidgets/widgetRegistry'
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

interface NodeWidgetsProps {
  node?: LGraphNode
  nodeData?: VueNodeData
  readonly?: boolean
  lodLevel?: LODLevel
}

const props = defineProps<NodeWidgetsProps>()

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
      vueComponent,
      simplified,
      value: widget.value,
      updateHandler
    })
  }

  return result
})
</script>
