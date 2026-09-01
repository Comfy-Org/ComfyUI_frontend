<script setup lang="ts" generic="T extends WidgetValue">
import { defineAsyncComponent, ref, watch } from 'vue'
import type { Component } from 'vue'

import Popover from '@/components/ui/Popover.vue'
import type {
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

import ValueControlButton from './ValueControlButton.vue'

const ValueControlPopover = defineAsyncComponent(
  () => import('./ValueControlPopover.vue')
)

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
      <Popover>
        <template #button>
          <ValueControlButton :mode="controlModel" class="self-center" />
        </template>
        <ValueControlPopover v-model="controlModel" />
      </Popover>
    </component>
  </div>
</template>
