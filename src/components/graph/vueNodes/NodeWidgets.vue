<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Widgets Error
  </div>
  <div v-else class="lg-node-widgets flex flex-col gap-2">
    <component
      :is="getWidgetComponent(widget)"
      v-for="(widget, index) in widgets"
      :key="`widget-${index}-${widget.name}`"
      v-model="widget.value"
      :widget="simplifiedWidget(widget)"
      :readonly="readonly"
      @update:model-value="(value: any) => handleWidgetUpdate(widget, value)"
    />
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { computed, onErrorCaptured, ref } from 'vue'

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
  return props.node.widgets?.filter((w) => !w.options?.hidden) || []
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

// Convert LiteGraph widget to SimplifiedWidget interface
const simplifiedWidget = (widget: IBaseWidget): SimplifiedWidget => {
  return {
    name: widget.name,
    type: widget.type,
    value: widget.value,
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
