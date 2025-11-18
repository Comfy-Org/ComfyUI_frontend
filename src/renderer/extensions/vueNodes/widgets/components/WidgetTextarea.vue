<template>
  <div class="widget-expands relative">
    <Textarea
      v-model="modelValue"
      v-bind="filteredProps"
      :class="
        cn(WidgetInputBaseClass, 'size-full text-xs lod-toggle resize-none')
      "
      :placeholder="placeholder || widget.name || ''"
      :aria-label="widget.name"
      :readonly="widget.options?.read_only"
      :disabled="widget.options?.read_only"
      fluid
      data-capture-wheel
    />
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import LODFallback from '../../components/LODFallback.vue'
import { WidgetInputBaseClass } from './layout'

const { widget, placeholder = '' } = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
}>()

const modelValue = defineModel<string>({ default: '' })

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)
</script>
