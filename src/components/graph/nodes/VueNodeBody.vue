<template>
  <!-- Render Vue component widgets only -->
  <div>
    <div
      v-for="widget in vueComponentWidgets"
      :key="`vue-widget-${widget.name}`"
      class="_sb_row _long_field"
    >
      <div class="_sb_col widget-content">
        <component
          :is="widget.component"
          :model-value="widget.value"
          :widget="widget"
          v-bind="widget.props"
          v-if="widgetsShouldShow"
          @update:model-value="updateWidgetValue(widget, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import type { BaseWidget } from '@comfyorg/litegraph'
import { computed, ref } from 'vue'

import { app } from '@/scripts/app'
import { isComponentWidget } from '@/scripts/domWidget'

const widgetsShouldShow = ref(true)

app.api.addEventListener('graphChanged', () => {
  widgetsShouldShow.value = app.canvas.ds.scale > .55
})

console.log('app.canvas.ds.scale', app.canvas.ds.scale)
interface VueNodeBodyProps {
  widgets: BaseWidget[]
  node: LGraphNode
}

const props = defineProps<VueNodeBodyProps>()

// Note: emit available for future widget change events if needed

// Get Vue component widgets only
const vueComponentWidgets = computed(() => {
  return props.widgets.filter((widget: any) => isComponentWidget(widget))
})

// Update widget value when component emits changes
const updateWidgetValue = (widget: any, value: any) => {
  if (widget.options?.setValue) {
    widget.options.setValue(value)
  }
  // Also trigger the widget's callback if it exists
  if (widget.callback) {
    widget.callback(value)
  }
}

// Note: onWidgetChange available for future use if needed
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
