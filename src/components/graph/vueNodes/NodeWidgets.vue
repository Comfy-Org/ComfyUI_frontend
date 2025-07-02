<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Widgets Error
  </div>
  <div v-else class="lg-node-widgets flex flex-col gap-2">
    <div
      v-for="(widget, index) in widgets"
      :key="`widget-${index}-${widget.name}`"
      class="widget-stub"
    >
      <div class="text-xs text-gray-400">{{ widget.name }}</div>
      <div class="text-sm text-gray-200 bg-gray-800 px-2 py-1 rounded">
        {{ widget.type }}: {{ getWidgetValue(widget) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { computed, onErrorCaptured, ref, markRaw } from 'vue'

import {
  WidgetType,
  getWidgetComponent as getWidgetComponentFromRegistry
} from '@/components/graph/vueWidgets/widgetRegistry'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

interface NodeWidgetsProps {
  node: LGraphNode
  readonly?: boolean
}

const props = defineProps<NodeWidgetsProps>()

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node widgets error:', error)
  return false
})

// Get non-hidden widgets
const widgets = computed(() => {
  // Mark widgets as raw to prevent Vue proxy wrapping
  return (props.node.widgets?.filter((w) => !w.options?.hidden) || []).map(w => markRaw(w))
})

// Map widget type to our widget registry
const getWidgetComponent = (widget: IBaseWidget) => {
  // Map LiteGraph widget types to our WidgetType enum
  const typeMapping: Record<string, WidgetType> = {
    number: WidgetType.SLIDER,
    float: WidgetType.SLIDER,
    int: WidgetType.SLIDER,
    string: WidgetType.STRING,
    text: WidgetType.TEXTAREA,
    combo: WidgetType.COMBO,
    toggle: WidgetType.BOOLEAN,
    boolean: WidgetType.BOOLEAN,
    button: WidgetType.BUTTON,
    color: WidgetType.COLOR,
    image: WidgetType.IMAGE,
    file: WidgetType.FILEUPLOAD
  }

  const widgetType = typeMapping[widget.type] || widget.type.toUpperCase()
  return getWidgetComponentFromRegistry(widgetType) || null
}

// Get widget value safely (handles private field access)
const getWidgetValue = (widget: IBaseWidget): any => {
  try {
    // The widget has a getter for value that accesses the private #value field
    return widget.value
  } catch {
    return undefined
  }
}

// Convert LiteGraph widget to SimplifiedWidget interface
const simplifiedWidget = (widget: IBaseWidget): SimplifiedWidget => {
  return {
    name: widget.name,
    type: widget.type,
    value: getWidgetValue(widget),
    options: widget.options,
    callback: widget.callback
  }
}

// Handle widget value updates
const handleWidgetUpdate = (widget: IBaseWidget, value: any) => {
  widget.value = value

  // Call widget callback if exists
  if (widget.callback) {
    widget.callback(value)
  }

  // Mark node as dirty for LiteGraph
  if (props.node.onWidgetChanged) {
    props.node.onWidgetChanged(widget.name, value, null, widget)
  }
}
</script>
