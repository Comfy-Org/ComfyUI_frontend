<template>
  <WidgetLayoutField :widget="layoutWidget">
    <div class="relative">
      <Loader
        v-if="loading"
        size="sm"
        class="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-component-node-foreground"
      />
      <InputText
        v-model="modelValue"
        v-bind="filteredProps"
        :class="
          cn(
            WidgetInputBaseClass,
            'w-full px-4 hover:bg-component-node-widget-background-hovered',
            size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs',
            loading && 'pl-9'
          )
        "
        :aria-label="widget.name"
        :readonly="isReadOnly"
        size="small"
        :pt="{ root: 'truncate min-w-[4ch]' }"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import Loader from '@/components/loader/Loader.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const {
  widget,
  size = 'medium',
  invalid = false,
  loading = false
} = defineProps<{
  widget: SimplifiedWidget<string>
  size?: 'medium' | 'large'
  invalid?: boolean
  loading?: boolean
}>()

const modelValue = defineModel<string>({ default: '' })

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const layoutWidget = computed(() => ({
  name: widget.name,
  label: widget.label,
  borderStyle: cn(
    widget.borderStyle,
    invalid && 'border border-destructive-background'
  )
}))
</script>
