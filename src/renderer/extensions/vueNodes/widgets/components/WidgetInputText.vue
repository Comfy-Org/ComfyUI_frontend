<template>
  <WidgetLayoutField
    data-testid="widget-text-row"
    :widget="layoutWidget"
    :display-label
    :input-id
    :value-text="modelValue"
    full-width-control
    :root-class="
      cn(!isReadOnly && 'hover:bg-muted', size === 'large' && 'py-3 text-sm')
    "
  >
    <div class="relative h-full">
      <Loader
        v-if="loading"
        size="sm"
        class="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-foreground"
      />
      <Input
        v-bind="filteredProps"
        :id="inputId"
        v-model="modelValue"
        :class="
          cn(
            WidgetInputBaseClass,
            'h-auto min-w-[4ch] truncate',
            size === 'large' ? 'py-3' : 'text-xs',
            'h-full px-2 text-right not-disabled:bg-transparent focus-visible:ring-0 aria-invalid:ring-0',
            loading && 'pl-9'
          )
        "
        :size="1"
        :aria-label="widget.name"
        :aria-invalid="invalid || undefined"
        :readonly="isReadOnly"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import Loader from '@/components/loader/Loader.vue'
import Input from '@comfyorg/design-system/input/Input'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import { cn } from '@comfyorg/tailwind-utils'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const {
  widgetId,
  displayLabel,
  size = 'medium',
  invalid = false,
  loading = false
} = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
  size?: 'medium' | 'large'
  invalid?: boolean
  loading?: boolean
}>()

const widget = useWidgetView(() => widgetId)

const modelValue = defineModel<string>({ default: '' })
const inputId = useId()

const filteredProps = computed(() =>
  filterWidgetProps(widget.value.options, INPUT_EXCLUDED_PROPS)
)

const isReadOnly = computed(() =>
  Boolean(widget.value.options?.read_only || widget.value.options?.disabled)
)

const layoutWidget = computed(() => ({
  name: widget.value.name,
  label: widget.value.label,
  borderStyle: cn(
    widget.value.borderStyle,
    invalid && 'border border-destructive'
  )
}))
</script>
