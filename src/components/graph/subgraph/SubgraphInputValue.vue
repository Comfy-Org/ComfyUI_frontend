<script setup lang="ts">
import { omit } from 'es-toolkit'
import { computed, provide } from 'vue'

import type { EditableInputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import {
  growableRegionsKey,
  useGrowableRegions
} from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'

const { source, label, status, resizable } = defineProps<{
  source: EditableInputValueSource | undefined
  label: string
  status: string | undefined
  resizable: boolean
}>()

const emit = defineEmits<{
  resize: [height: number]
  commit: []
}>()

const { processedWidgets } = useProcessedWidgets(
  () => source?.node,
  () => source && [source.widgetId],
  { contextMenu: false }
)
const widgets = computed(() =>
  processedWidgets.value.map((widget) => omit(widget, ['slotMetadata']))
)

const growable = useGrowableRegions({
  regionId: () => source?.widgetId,
  resizeNode: (height) => emit('resize', height),
  onCommit: () => emit('commit'),
  rootSelector: '[data-subgraph-io-panel]'
})
provide(growableRegionsKey, {
  heightOf: growable.heightOf,
  handle: computed(() => (resizable ? growable.handle : undefined))
})
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
