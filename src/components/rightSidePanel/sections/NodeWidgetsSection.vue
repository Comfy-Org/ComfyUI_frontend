<template>
  <div v-if="hasWidgets" class="node-widgets-section">
    <div
      class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-foreground-muted"
    >
      {{ $t('rightSidePanel.widgets') }}
    </div>
    <div class="space-y-4 rounded-lg bg-interface-surface p-3">
      <div
        v-for="(widget, index) in visibleWidgets"
        :key="`widget-${index}-${widget.name}`"
        class="widget-item flex flex-col gap-1.5"
      >
        <component
          :is="getWidgetComponent(widget)"
          :widget="widget"
          :model-value="widget.value"
          :node-id="String(node.id)"
          :node-type="node.type"
          @update:model-value="
            (value: string | number | boolean | object) =>
              onWidgetValueChange(widget, value)
          "
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'

const { node } = defineProps<{
  node: LGraphNode
}>()

const canvasStore = useCanvasStore()

const hasWidgets = computed(() => {
  return node.widgets && node.widgets.length > 0
})

const visibleWidgets = computed(() => {
  if (!node.widgets) return []
  return node.widgets.filter((widget: IBaseWidget) => {
    // Filter out hidden or canvas-only widgets
    return !widget.options?.hidden && !widget.options?.canvasOnly
  })
})

function getWidgetComponent(widget: IBaseWidget) {
  const component = getComponent(widget.type, widget.name)
  return component || WidgetLegacy
}

function onWidgetValueChange(
  widget: IBaseWidget,
  value: string | number | boolean | object
) {
  widget.value = value
  widget.callback?.(value)
  canvasStore.canvas?.setDirty(true, true)
}
</script>
