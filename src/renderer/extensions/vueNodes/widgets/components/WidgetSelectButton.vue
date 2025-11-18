<template>
  <WidgetLayoutField :widget="widget">
    <FormSelectButton
      v-model="modelValue"
      :options="widget.options?.values || []"
      class="w-full"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import FormSelectButton from './form/FormSelectButton.vue'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<string>
}>()

const modelValue = defineModel<string>({ default: '' })
</script>
