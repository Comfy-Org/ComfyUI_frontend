<template>
  <WidgetLayoutField :widget="widget">
    <InputText
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      class="w-full text-xs py-2 px-4 bg-zinc-500/10 border-none outline outline-1 outline-offset-[-1px] outline-zinc-300/10 !rounded-lg hover:outline-blue-500/80"
      size="small"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useStringWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
)
</script>
