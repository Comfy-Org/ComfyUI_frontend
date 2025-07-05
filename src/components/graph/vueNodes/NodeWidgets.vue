<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Widgets Error
  </div>
  <div v-else class="lg-node-widgets flex flex-col gap-2">
    <component
      :is="getVueComponent(widget)"
      v-for="(widget, index) in supportedWidgets"
      :key="`widget-${index}-${widget.name}`"
      :widget="simplifiedWidget(widget)"
      :model-value="getWidgetValue(widget)"
      :readonly="readonly"
      @update:model-value="
        (value: unknown) => handleWidgetUpdate(widget, value)
      "
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
import { useWidgetRenderer } from '@/composables/graph/useWidgetRenderer'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

interface NodeWidgetsProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
}

const props = defineProps<NodeWidgetsProps>()

// Use widget renderer composable
const { getWidgetComponent, shouldRenderAsVue } = useWidgetRenderer()

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node widgets error:', error)
  return false
})

const nodeInfo = computed(() => props.nodeData || props.node)

// Get non-hidden widgets
const widgets = computed((): SafeWidgetData[] => {
  const info = nodeInfo.value
  if (!info?.widgets) return []

  const filtered = (info.widgets as SafeWidgetData[]).filter(
    (w: SafeWidgetData) => !w.options?.hidden
  )
  return filtered
})

// Only render widgets that have Vue component support
const supportedWidgets = computed((): SafeWidgetData[] => {
  const allWidgets = widgets.value
  const supported = allWidgets.filter((widget: SafeWidgetData) => {
    return shouldRenderAsVue(widget)
  })
  return supported
})

// Get Vue component for widget
const getVueComponent = (widget: SafeWidgetData) => {
  const componentName = getWidgetComponent(widget.type)
  const component = widgetTypeToComponent[componentName]
  return component || WidgetInputText // Fallback to text input
}

const getWidgetValue = (widget: SafeWidgetData): unknown => {
  return widget.value
}

const simplifiedWidget = (widget: SafeWidgetData): SimplifiedWidget => {
  return {
    name: widget.name,
    type: widget.type,
    value: getWidgetValue(widget),
    options: widget.options,
    callback: widget.callback
  }
}

// Handle widget value updates
const handleWidgetUpdate = (widget: SafeWidgetData, value: unknown) => {
  // Call LiteGraph callback to update the authoritative state
  // The callback will trigger the chained callback in useGraphNodeManager
  // which will update the Vue state automatically
  if (widget.callback) {
    widget.callback(value)
  }
}
</script>
