<script setup lang="ts" generic="T extends WidgetValue">
import { computed } from 'vue'
import type { Component } from 'vue'

import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { widgetControl } from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import ValueControlButton from './ValueControlButton.vue'
import ValueControlPopover from './ValueControlPopover.vue'

const { widgetId, displayLabel, component } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
  component: Component
}>()

const modelValue = defineModel<T>()

const controlModel = computed({
  get: () => widgetControl(widgetId)?.value,
  set: (mode) => widgetControl(widgetId)?.update(mode)
})
</script>
<template>
  <component
    :is="component"
    v-model="modelValue"
    class="relative"
    :widget-id
    :display-label
  >
    <template #between>
      <PopoverRoot v-if="controlModel">
        <PopoverTrigger as-child>
          <ValueControlButton
            :mode="controlModel"
            class="mx-1 self-center"
            @pointerdown.stop
            @pointermove.stop
            @pointerup.stop
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          :side-offset="5"
          dismiss-on-viewport-change
          class="w-auto overflow-visible rounded-lg border-border/50 p-2 shadow-sm"
        >
          <ValueControlPopover v-model="controlModel" />
          <PopoverArrow class="fill-background stroke-border/50" />
        </PopoverContent>
      </PopoverRoot>
    </template>
  </component>
</template>
