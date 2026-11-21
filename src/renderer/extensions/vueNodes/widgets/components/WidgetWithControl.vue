<script setup lang="ts" generic="T extends WidgetValue">
import type { Component } from 'vue'

import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import type {
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

import ValueControlButton from './ValueControlButton.vue'
import ValueControlPopover from './ValueControlPopover.vue'

const { widget, component } = defineProps<{
  widget: SimplifiedControlWidget<T>
  component: Component
}>()

const modelValue = defineModel<T>()
</script>
<template>
  <div class="relative">
    <component :is="component" v-bind="$attrs" v-model="modelValue" :widget>
      <template #between>
        <PopoverRoot>
          <PopoverTrigger as-child>
            <ValueControlButton
              :mode="widget.controlWidget.value"
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
            <ValueControlPopover
              :model-value="widget.controlWidget.value"
              @update:model-value="widget.controlWidget.update"
            />
            <PopoverArrow class="fill-background stroke-border/50" />
          </PopoverContent>
        </PopoverRoot>
      </template>
    </component>
  </div>
</template>
