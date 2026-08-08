<script setup lang="ts">
import { computed } from 'vue'

import type {
  SimplifiedControlWidget,
  SimplifiedWidget
} from '@/types/simplifiedWidget'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetWithControl from './WidgetWithControl.vue'

import Button from '@/components/ui/button/Button.vue'
import { randomizeNumberValue } from '@/scripts/valueControl'

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

const controlWidget = computed<SimplifiedControlWidget<number> | null>(() =>
  props.widget.controlWidget
    ? (props.widget as SimplifiedControlWidget<number>)
    : null
)

const widgetComponent = computed(() => {
  switch (props.widget.type) {
    case 'gradientslider':
      return WidgetInputNumberGradientSlider
    case 'slider':
      return WidgetInputNumberSlider
    default:
      return WidgetInputNumberInput
  }
})

const isRandomizeEnabled = computed(() => {
  return (props.widget?.options as any)?.component === 'SetRandomInt'
})

function randomize() {
  modelValue.value = randomizeNumberValue(props.widget.options ?? {})
}
</script>

<template>
  <!-- Conditional block in the template of existing widget component -->
  <div v-if="isRandomizeEnabled" class="grid grid-cols-subgrid gap-y-1" v-bind="$attrs">
    <WidgetWithControl
      v-if="controlWidget"
      v-model="modelValue"
      :widget="controlWidget"
      :component="widgetComponent"
      class="col-span-2"
    />
    <component
      :is="widgetComponent"
      v-else
      v-model="modelValue"
      :widget="widget"
      class="col-span-2"
    />
    
    <!-- The generic randomize button component -->
    <Button
      class="col-span-2 w-full justify-center gap-1 border-0 bg-component-node-widget-background p-2 text-base-foreground"
      size="sm"
      variant="textonly"
      @click="randomize"
    >
      <i class="icon-[lucide--dices]" />
      {{ $t('g.randomize') }}
    </Button>
  </div>

  <!-- Standard layout fallback if Randomize is not enabled -->
  <template v-else>
    <WidgetWithControl
      v-if="controlWidget"
      v-model="modelValue"
      :widget="controlWidget"
      :component="widgetComponent"
      v-bind="$attrs"
    />
    <component
      :is="widgetComponent"
      v-else
      v-model="modelValue"
      :widget="widget"
      v-bind="$attrs"
    />
  </template>
</template>