<template>
  <div class="relative">
    <Textarea
      v-model="localValue"
      v-bind="filteredProps"
      :class="
        cn(WidgetInputBaseClass, 'size-full text-xs lod-toggle resize-none')
      "
      :placeholder="placeholder || widget.name || ''"
      :aria-label="widget.name"
      fluid
      data-capture-wheel="true"
      @update:model-value="onChange"
    />
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import LODFallback from '../../components/LODFallback.vue'
import { WidgetInputBaseClass } from './layout'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  placeholder?: string
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
