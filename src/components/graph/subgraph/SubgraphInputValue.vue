<script setup lang="ts">
import { omit } from 'es-toolkit'
import { computed } from 'vue'

import type { EditableInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'

const { source, label, status } = defineProps<{
  source: EditableInputValueSource | undefined
  label: string
  status: string | undefined
}>()

const { processedWidgets } = useProcessedWidgets(
  () => source?.node,
  () => source && [source.widgetId],
  { contextMenu: false }
)
const widgets = computed(() =>
  processedWidgets.value.map((widget) => omit(widget, ['slotMetadata']))
)
</script>

<template>
  <WidgetGrid
    v-if="source && widgets.length"
    :key="source.widgetId"
    :processed-widgets="widgets"
    :node-id="source.node.id"
    :node-type="source.node.type"
    :node-title="source.node.title"
    :sync-layout="false"
  />
  <div
    v-else
    class="mx-3 flex h-(--node-widget-height) min-w-0 items-center gap-2 rounded-(--node-widget-radius) bg-input/50 px-3"
  >
    <span class="truncate">{{ label }}</span>
    <span class="ml-auto truncate text-muted-foreground italic empty:hidden">{{
      status
    }}</span>
  </div>
</template>
