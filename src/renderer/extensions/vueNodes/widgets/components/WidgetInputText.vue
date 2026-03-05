<template>
  <WidgetLayoutField :widget="layoutWidget">
    <div class="relative">
      <i
        v-if="loading"
        class="icon-[lucide--loader-circle] absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-component-node-foreground"
      />
      <InputText
        v-model="modelValue"
        v-bind="filteredProps"
        :class="
          cn(
            WidgetInputBaseClass,
            'w-full px-4 hover:bg-component-node-widget-background-hovered',
            size === 'large' ? 'text-sm py-3' : 'text-xs py-2',
            loading && 'pl-9'
          )
        "
        :aria-label="widget.name"
        :readonly="isReadOnly"
        :size="size === 'large' ? undefined : 'small'"
        :pt="{ root: 'truncate min-w-[4ch]' }"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

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
