<template>
  <FloatLabel
    variant="on"
    :unstyled="hideLayoutField"
    :class="
      cn(
        'rounded-lg space-y-1 focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
        '[&_label]:bg-transparent [&_label]:text-component-node-foreground-secondary [&_label]:text-xs',
        widget.borderStyle
      )
    "
  >
    <Textarea
      v-bind="filteredProps"
      :id
      v-model="modelValue"
      :class="cn(WidgetInputBaseClass, 'size-full text-xs resize-none')"
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
    <label v-if="!hideLayoutField" :for="id">{{ displayName }}</label>
  </FloatLabel>
</template>

<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel'
import Textarea from 'primevue/textarea'
import { computed, useId } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
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

const hideLayoutField = useHideLayoutField()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()
</script>
