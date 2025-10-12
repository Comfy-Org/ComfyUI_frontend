<script setup lang="ts">
import Button from 'primevue/button'
import { defineAsyncComponent, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { useControlButtonIcon } from '../composables/useControlButtonIcon'
import {
  NumberControlMode,
  useStepperControl
} from '../composables/useStepperControl'
import WidgetInputNumberInput from './WidgetInputNumberInput.vue'

const NumberControlPopover = defineAsyncComponent(
  () => import('./NumberControlPopover.vue')
)

const props = defineProps<{
  widget: SimplifiedWidget<number>
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const modelValue = defineModel<number>({ default: 0 })
const popover = ref()

const handleControlChange = (newValue: number) => {
  modelValue.value = newValue
  emit('update:modelValue', newValue)
}

const { controlMode } = useStepperControl(modelValue, {
  ...props.widget.options,
  onChange: handleControlChange
})

if (controlMode.value === NumberControlMode.FIXED) {
  controlMode.value = NumberControlMode.RANDOMIZE
}

const controlButtonIcon = useControlButtonIcon(controlMode)

const setControlMode = (mode: NumberControlMode) => {
  controlMode.value = mode
}

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <div class="relative">
    <WidgetInputNumberInput
      v-model="modelValue"
      :widget="widget"
      :readonly="readonly"
    />

    <Button
      variant="link"
      size="small"
      class="absolute right-12 top-1/2 -translate-y-1/2 h-4 w-7 p-0 bg-blue-100/30 rounded-xl"
      @click="togglePopover"
    >
      <i :class="`${controlButtonIcon} text-blue-100 text-xs`" />
    </Button>

    <NumberControlPopover
      ref="popover"
      :control-mode="controlMode"
      @update:control-mode="setControlMode"
    />
  </div>
</template>
