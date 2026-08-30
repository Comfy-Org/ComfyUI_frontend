<template>
  <WidgetLayoutField :widget="layoutWidget">
    <div class="relative">
      <Loader
        v-if="loading"
        size="sm"
        class="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-component-node-foreground"
      />
      <Input
        v-model="modelValue"
        v-bind="filteredProps"
        :class="
          cn(
            WidgetInputBaseClass,
            'h-auto w-full min-w-[4ch] truncate px-4',
            !isReadOnly && 'hover:bg-component-node-widget-background-hovered',
            size === 'large'
              ? 'pt-[13px] pb-[11px] text-sm'
              : 'pt-[9px] pb-[7px] text-xs',
            loading && 'pl-9'
          )
        "
        :aria-label="widget.name"
        :aria-invalid="invalid || undefined"
        :readonly="isReadOnly"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Loader from '@/components/loader/Loader.vue'
import Input from '@/components/ui/input/Input.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'
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
