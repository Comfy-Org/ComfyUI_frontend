<script setup lang="ts">
import Button from 'primevue/button'
import { defineAsyncComponent, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { NumberControlMode } from '../composables/useStepperControl'
import { useStepperControl } from '../composables/useStepperControl'
import WidgetInputNumberInput from './WidgetInputNumberInput.vue'

const NumberControlPopover = defineAsyncComponent(
  () => import('./NumberControlPopover.vue')
)

const props = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })
const popover = ref()

const handleControlChange = (newValue: number) => {
  modelValue.value = newValue
}

const { controlMode, controlButtonIcon } = useStepperControl(
  modelValue,
  {
    ...props.widget.options,
    onChange: handleControlChange
  },
  props.widget.controlWidget!.value
)

const setControlMode = (mode: NumberControlMode) => {
  controlMode.value = mode
  props.widget.controlWidget!.update(mode)
}

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <div class="relative grid grid-cols-subgrid">
    <WidgetInputNumberInput
      v-model="modelValue"
      :widget
      class="grid grid-cols-subgrid col-span-2"
    >
      <Button
        variant="link"
        size="small"
        class="h-4 w-7 self-center rounded-xl bg-blue-100/30 p-0"
        @click="togglePopover"
      >
        <i :class="`${controlButtonIcon} text-blue-100 text-xs`" />
      </Button>
    </WidgetInputNumberInput>
    <NumberControlPopover
      ref="popover"
      :control-mode
      @update:control-mode="setControlMode"
    />
  </div>
</template>
