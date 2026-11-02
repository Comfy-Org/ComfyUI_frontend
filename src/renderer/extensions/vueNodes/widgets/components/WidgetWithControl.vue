<script setup lang="ts" generic="T extends WidgetValue">
import { ref, watch } from 'vue'
import type { Component } from 'vue'

import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import type {
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

import ValueControlButton from './ValueControlButton.vue'
import ValueControlPopover from './ValueControlPopover.vue'

const props = defineProps<{
  widget: SimplifiedControlWidget<T>
  component: Component
}>()

const modelValue = defineModel<T>()

const controlModel = ref(props.widget.controlWidget.value)

watch(controlModel, props.widget.controlWidget.update)
</script>
<template>
  <div class="relative grid grid-cols-subgrid">
    <component :is="component" v-bind="$attrs" v-model="modelValue" :widget>
      <PopoverRoot>
        <PopoverTrigger as-child>
          <ValueControlButton :mode="controlModel" class="mr-1 self-center" />
        </PopoverTrigger>
        <PopoverContent
          :side-offset="5"
          dismiss-on-viewport-change
          class="w-auto overflow-visible rounded-lg border-border/50 p-2 shadow-sm"
        >
          <ValueControlPopover v-model="controlModel" />
          <PopoverArrow class="fill-background stroke-border/50" />
        </PopoverContent>
      </PopoverRoot>
    </component>
  </div>
</template>
