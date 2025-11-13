<script setup lang="ts">
import Button from 'primevue/button'
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { useComboControl } from '../composables/useComboControl'
import { useControlButtonIcon } from '../composables/useControlButtonIcon'
import { NumberControlMode } from '../composables/useStepperControl'
import WidgetSelectBase from './WidgetSelectBase.vue'

const NumberControlPopover = defineAsyncComponent(
  () => import('./NumberControlPopover.vue')
)

type ComboValue = string | number | undefined

const props = defineProps<{
  widget: SimplifiedWidget<ComboValue>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ComboValue]
}>()

const modelValue = defineModel<ComboValue>({ default: undefined })
const modelRef = modelValue as Ref<ComboValue>

const hasControlAfterGenerate = computed(
  () => props.widget.spec?.control_after_generate === true
)

const popover = ref()

const availableValues = computed<ComboValue[]>(() => {
  const values = props.widget.options?.values
  if (Array.isArray(values)) return values
  if (typeof values === 'function') {
    try {
      const result = values()
      return Array.isArray(result) ? result : []
    } catch (error) {
      return []
    }
  }
  if (values && typeof values === 'object') {
    return Object.values(values) as ComboValue[]
  }
  return []
})

const updateModelValue = (value: ComboValue) => {
  modelRef.value = value
  emit('update:modelValue', value)
}

const controlModeRef: Ref<NumberControlMode> = hasControlAfterGenerate.value
  ? (() => {
      const comboControl = useComboControl(modelRef, {
        values: availableValues,
        onChange: updateModelValue
      })
      if (comboControl.controlMode.value === NumberControlMode.FIXED) {
        comboControl.controlMode.value = NumberControlMode.RANDOMIZE
      }
      return comboControl.controlMode
    })()
  : ref(NumberControlMode.FIXED)

const controlButtonIcon = useControlButtonIcon(controlModeRef)

const togglePopover = (event: Event) => {
  popover.value?.toggle(event)
}

const setControlMode = (mode: NumberControlMode) => {
  controlModeRef.value = mode
}
</script>

<template>
  <div v-if="hasControlAfterGenerate" class="relative">
    <WidgetSelectBase
      :widget="widget"
      :model-value="modelValue"
      @update:model-value="updateModelValue"
    />

    <Button
      variant="link"
      size="small"
      class="absolute top-1/2 right-12 h-4 w-7 -translate-y-1/2 rounded-xl bg-blue-100/30 p-0"
      @click="togglePopover"
    >
      <i :class="`${controlButtonIcon} text-blue-100 text-xs`" />
    </Button>

    <NumberControlPopover
      ref="popover"
      :control-mode="controlModeRef"
      @update:control-mode="setControlMode"
    />
  </div>
  <WidgetSelectBase
    v-else
    :widget="widget"
    :model-value="modelValue"
    @update:model-value="updateModelValue"
  />
</template>
