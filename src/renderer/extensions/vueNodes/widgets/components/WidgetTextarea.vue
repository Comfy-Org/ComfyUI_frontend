<template>
  <FloatLabel
    variant="in"
    :class="
      cn(
        'space-y-1 rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted',
        widget.borderStyle
      )
    "
  >
    <Textarea
      v-bind="filteredProps"
      :id
      v-model="modelValue"
      :class="cn(WidgetInputBaseClass, 'size-full resize-none text-xs')"
      :placeholder
      :readonly="widget.options?.read_only"
      :disabled="widget.options?.read_only"
      fluid
      data-capture-wheel="true"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
      @contextmenu.capture.stop
    />
    <label :for="id">{{ displayName }}</label>
  </FloatLabel>
</template>

<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel'
import Textarea from 'primevue/textarea'
import { computed, useId } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'

const { widget, placeholder = '' } = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
}>()

const modelValue = defineModel<string>({ default: '' })

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()
</script>
