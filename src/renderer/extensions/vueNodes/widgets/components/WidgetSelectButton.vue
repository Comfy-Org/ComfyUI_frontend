<template>
  <WidgetLayoutField :widget="widget">
    <FormSelectButton
      v-model="localValue"
      :options="selectOptions"
      class="w-full"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import { isSelectButtonInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import FormSelectButton from './form/FormSelectButton.vue'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
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

// Extract spec options directly
const selectOptions = computed(() => {
  const spec = props.widget.spec
  if (!spec || !isSelectButtonInputSpec(spec)) {
    return []
  }
  return spec.options?.values || []
})
</script>
