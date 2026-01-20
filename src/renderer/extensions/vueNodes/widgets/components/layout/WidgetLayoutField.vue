<script setup lang="ts">
import { computed, inject } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAdvancedWidgetOverridesStore } from '@/stores/workspace/advancedWidgetOverridesStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

const { widget } = defineProps<{
  widget: Pick<
    SimplifiedWidget<string | number | undefined>,
    'name' | 'label' | 'borderStyle' | 'advanced'
  >
}>()

const hideLayoutField = inject<boolean>('hideLayoutField', false)
const node = inject<LGraphNode | null>('node', null)

const advancedOverridesStore = useAdvancedWidgetOverridesStore()

const isAdvanced = computed(() => {
  if (!node) return !!widget.advanced
  return advancedOverridesStore.getAdvancedState(node, {
    name: widget.name,
    options: { advanced: widget.advanced }
  } as any)
})

function toggleAdvanced() {
  if (!node) return
  advancedOverridesStore.toggleAdvanced(node, widget.name)
}
</script>

<template>
  <div
    class="grid grid-cols-subgrid min-w-0 justify-between gap-1 text-node-component-slot-text"
  >
    <div
      v-if="!hideLayoutField"
      class="truncate content-center-safe flex items-center gap-2"
    >
      <template v-if="widget.name">
        {{ widget.label || widget.name }}
      </template>
    </div>
    <!-- basis-full grow -->
    <div class="relative min-w-0 flex-1">
      <div
        :class="
          cn(
            'cursor-default min-w-0 rounded-lg focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
            widget.borderStyle
          )
        "
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      >
        <slot />
      </div>
    </div>

    <button
      :class="
        cn(
          'absolute right-1 hover:scale-150 size-2 rounded-full p-0 m-0 ring-0 border-none z-10',
          isAdvanced ? 'bg-green-500' : 'bg-gray-500'
        )
      "
      @click.stop="toggleAdvanced"
    />
  </div>
</template>
