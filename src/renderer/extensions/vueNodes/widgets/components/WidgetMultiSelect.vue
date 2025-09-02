<template>
  <WidgetLayoutField :widget="widget">
    <MultiSelect
      v-model="localValue"
      :options="widget.options?.values || []"
      :disabled="readonly"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      size="small"
      display="chip"
      :pt="{
        option: 'text-xs'
      }"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<any[]>
  modelValue: any[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any[]]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: [],
  emit
})
</script>
