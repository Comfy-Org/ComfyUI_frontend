<template>
  <div
    class="flex size-full items-center gap-2"
    data-testid="colors"
    @pointerdown.stop
  >
    <span v-if="widget?.name" class="shrink-0 truncate">
      {{ widget.label || widget.name }}
    </span>
    <PaletteSwatchRow
      v-model="modelValue"
      :max="MAX_COLORS"
      @edit-end="commitAfterUpdate"
    />
    <WidgetHistoryButtons
      class="ml-auto"
      :can-undo
      :can-redo
      @undo="undo"
      @redo="redo"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'

import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'
import { useWidgetValueHistory } from '@/composables/useWidgetValueHistory'
import { widgetHistoryScope } from '@/composables/widgetHistoryScope'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import PaletteSwatchRow from './PaletteSwatchRow.vue'

const MAX_COLORS = 16

const { widget, nodeId } = defineProps<{
  widget?: Pick<SimplifiedWidget<string[]>, 'name' | 'label' | 'nodeLocatorId'>
  nodeId?: NodeId
}>()

const modelValue = defineModel<string[]>({ default: () => [] })

function isColorList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((color) => typeof color === 'string')
  )
}

const { canUndo, canRedo, undo, redo, commit } = useWidgetValueHistory({
  scope: () => (widget ? widgetHistoryScope(widget, nodeId) : null),
  read: () => modelValue.value,
  apply: (value) => {
    if (isColorList(value)) modelValue.value = value
  }
})

function commitAfterUpdate(mergeKey?: string) {
  void nextTick(() => commit(mergeKey))
}
</script>
