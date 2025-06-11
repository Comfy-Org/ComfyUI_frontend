<template>
  <div class="vue-node-body">
    <!-- Render widgets using existing Vue widget system -->
    <div 
      v-for="(widget, index) in widgets" 
      :key="`widget-${index}`"
      class="widget-container mb-2 last:mb-0"
    >
      <!-- Use existing Vue widget components if available -->
      <component
        v-if="getWidgetComponent(widget)"
        :is="getWidgetComponent(widget)"
        :widget="widget"
        v-model="widget.value"
        @update:model-value="onWidgetChange(index, $event)"
      />
      
      <!-- Fallback for non-Vue widgets -->
      <div 
        v-else
        class="legacy-widget p-2 bg-gray-50 dark-theme:bg-gray-700 rounded text-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ widget.name || 'Widget' }}</span>
          <span class="text-gray-500">{{ widget.type || 'unknown' }}</span>
        </div>
        <div class="mt-1 text-gray-600 dark-theme:text-gray-400">
          Value: {{ formatWidgetValue(widget.value) }}
        </div>
      </div>
    </div>
    
    <!-- Message when no widgets -->
    <div 
      v-if="widgets.length === 0" 
      class="text-center text-gray-500 dark-theme:text-gray-400 text-sm py-2"
    >
      No widgets
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import type { BaseWidget } from '@comfyorg/litegraph'
// Import existing Vue widget components
import StringWidget from '@/components/graph/widgets/StringWidget.vue'
import ColorPickerWidget from '@/components/graph/widgets/ColorPickerWidget.vue'
import ImagePreviewWidget from '@/components/graph/widgets/ImagePreviewWidget.vue'
import ImageUploadWidget from '@/components/graph/widgets/ImageUploadWidget.vue'

interface VueNodeBodyProps {
  widgets: BaseWidget[]
  node: LGraphNode
}

const props = defineProps<VueNodeBodyProps>()

const emit = defineEmits<{
  'widget-change': [widgetIndex: number, value: any]
}>()

// Map widget types to Vue components
const widgetComponentMap: Record<string, any> = {
  'STRING': StringWidget,
  'text': StringWidget,
  'COLOR': ColorPickerWidget,
  'color': ColorPickerWidget,
  'IMAGE': ImagePreviewWidget,
  'image': ImagePreviewWidget,
  'IMAGEUPLOAD': ImageUploadWidget,
  'image_upload': ImageUploadWidget
}

// Get the Vue component for a widget type
const getWidgetComponent = (widget: BaseWidget) => {
  const widgetType = widget.type?.toUpperCase()
  return widgetType ? widgetComponentMap[widgetType] : null
}

// Format widget value for display
const formatWidgetValue = (value: any) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 47) + '...'
  }
  return String(value)
}

const onWidgetChange = (index: number, value: any) => {
  emit('widget-change', index, value)
  
  // Trigger node property change if the widget has a callback
  const widget = props.widgets[index]
  if (widget?.callback) {
    // Note: callback signature may need adjustment based on widget requirements
    widget.callback(value, null, props.node, [0, 0], {})
  }
}
</script>

<style scoped>
.vue-node-body {
  min-height: 2rem;
}

.widget-container {
  /* Widget containers use flexbox for natural sizing */
}

.legacy-widget {
  /* Styling for non-Vue widgets */
  border: 1px dashed #ccc;
}
</style>